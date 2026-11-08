"""Codex restrito à pesquisa web; configuração/argumentos nunca vêm da página."""
import copy
import json
import os
import queue
import subprocess
import threading
import time
from pathlib import Path
from uuid import uuid4

from .agent_sandbox import AgentError, doctor, environment, executable, permission_profile

DISABLED = ('shell_tool', 'view_image', 'apps', 'plugins', 'remote_plugin', 'browser_use',
            'browser_use_external', 'computer_use', 'in_app_browser', 'multi_agent', 'hooks',
            'skill_search', 'skill_mcp_dependency_install', 'code_mode', 'tool_suggest')


def strict_schema(schema):
    value = copy.deepcopy(schema)

    def visit(node):
        if isinstance(node, dict):
            node.pop('default', None)
            if node.get('type') == 'object':
                node['additionalProperties'] = False
                node['required'] = list(node.get('properties', {}))
            for item in node.values():
                visit(item)
        elif isinstance(node, list):
            for item in node:
                visit(item)
    visit(value)
    return value


def arguments(cli, work, web=True):
    settings = ['windows.sandbox="mxc"', 'default_permissions="crm_research"', permission_profile(),
                'approval_policy="never"', 'project_doc_max_bytes=0', 'shell_environment_policy.inherit="none"',
                'skills.bundled.enabled=false', 'skills.include_instructions=false',
                'features.code_mode_host=true',
                'features.skip_host_skill_discovery=true', 'web_search="live"' if web else 'web_search="disabled"']
    settings += ['features.' + key + '=false' for key in DISABLED]
    args = [str(cli), 'exec', '--strict-config', '--ignore-user-config', '--ignore-rules', '--ephemeral',
            '--skip-git-repo-check', '--json', '--color', 'never', '-C', str(work),
            '--output-schema', str(work / 'schema.json'), '--output-last-message', str(work / 'result.json')]
    for setting in settings:
        args.extend(['-c', setting])
    return args + ['-']


def terminate(process):
    if process.poll() is None:
        # The PID belongs to this live Popen; no browser input can choose a process.
        killer = Path(os.environ.get('SystemRoot', 'C:/Windows')) / 'System32/taskkill.exe'
        subprocess.run([str(killer), '/PID', str(process.pid), '/T', '/F'], capture_output=True,
                       timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
        if process.poll() is None:
            process.kill()
    process.wait(timeout=10)


class NativeCodex:
    def __init__(self, root):
        self.root = Path(root).resolve()

    def check(self):
        return doctor(self.root)

    def run(self, packet, cancelled, progress, timeout=900, web=True):
        if cancelled.is_set():
            raise AgentError('cancelled')
        self.check()
        work = self.root / ('run-' + uuid4().hex)
        work.mkdir()
        schema = strict_schema(packet['schema'])
        (work / 'schema.json').write_text(json.dumps(schema, ensure_ascii=False), encoding='utf-8')
        prompt = packet['prompt']
        if 'input' in packet:
            prompt += '\nINPUT:\n' + json.dumps(packet['input'], ensure_ascii=False)
            prompt += '\nINPUT_HASH: ' + packet['input_hash']
        if not isinstance(prompt, str) or len(prompt.encode('utf-8')) > 100000:
            raise AgentError('input_too_large')
        if cancelled.is_set():
            raise AgentError('cancelled')
        process = subprocess.Popen(arguments(executable(), work, web), cwd=work, env=environment(work),
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
        chunks = queue.Queue()
        stopped = threading.Event()

        def read():
            total = 0
            try:
                while data := process.stdout.read(4096):
                    total += len(data)
                    if total > 4 * 1024 * 1024:
                        chunks.put(AgentError('output_too_large'))
                        break
                    if stopped.is_set():
                        break
                    chunks.put(data)
            finally:
                chunks.put(None)

        reader = threading.Thread(target=read, daemon=True)
        reader.start()
        started = time.monotonic()
        pending = b''
        searches = 0
        try:
            process.stdin.write(prompt.encode('utf-8'))
            process.stdin.close()
            ended = False
            while not ended:
                if cancelled.is_set():
                    raise AgentError('cancelled')
                if time.monotonic() - started > timeout:
                    raise AgentError('timeout')
                try:
                    item = chunks.get(timeout=.2)
                except queue.Empty:
                    continue
                if isinstance(item, AgentError):
                    raise item
                if item is None:
                    ended = True
                    continue
                pending += item
                while b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    try:
                        event = json.loads(line)
                    except (ValueError, UnicodeError):
                        continue
                    kind = event.get('item', {}).get('type')
                    if kind == 'web_search' and event.get('type') == 'item.completed':
                        searches += 1
                        progress('web_search', searches)
                    if searches > 80:
                        raise AgentError('search_limit')
                    if kind in ('command_execution', 'mcp_tool_call', 'file_change', 'collab_tool_call'):
                        raise AgentError('unexpected_tool')
            if cancelled.is_set():
                raise AgentError('cancelled')
            if process.wait(timeout=10) != 0:
                raise AgentError('agent_failed')
            output = work / 'result.json'
            if output.is_symlink() or not output.is_file() or output.stat().st_size > 262144:
                raise AgentError('invalid_result')
            return json.loads(output.read_text(encoding='utf-8'))
        except (OSError, ValueError, subprocess.TimeoutExpired):
            raise AgentError('agent_failed') from None
        finally:
            stopped.set()
            terminate(process)
            process.stdout.close()
            reader.join(timeout=2)
