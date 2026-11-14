# -*- coding: utf-8 -*-
"""tools/quem_mexeu.py e o hook de assinatura: quem mexeu em cada arquivo solto, e quem fez o commit."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / 'tools' / 'quem_mexeu.py'
HOOK = RAIZ / 'tools' / 'git-hooks' / 'prepare-commit-msg'


def jsonl(caminho, linhas):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text('\n'.join(json.dumps(l, separators=(',', ':')) for l in linhas), encoding='utf-8')


class QuemMexeuTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = self.tmp / 'repo'
        subprocess.run(['git', 'init', '-q', str(self.repo)], check=True)
        self.env = {k: v for k, v in os.environ.items()
                    if k.upper() not in ('CLAUDECODE', 'CODEX_HOME', 'PSMODULEPATH')}

    def test_atribui_cada_arquivo_solto_ao_agente_e_a_conversa(self):
        for nome in ('do_codex.py', 'do_claude.md', 'render.png'):
            (self.repo / nome).write_text('x')
        home = self.tmp / 'home'
        jsonl(home / '.codex/sessions/2026/10/19/rollout-a.jsonl', [
            {'timestamp': '2026-10-19T10:00:00Z', 'type': 'session_meta', 'payload': {'id': 'c0dex'}},
            {'timestamp': '2026-10-19T10:00:01Z', 'type': 'event_msg', 'payload': {'type': 'item_completed',
             'item': {'type': 'UserMessage', 'content': [{'type': 'text', 'text': 'arruma o mapa'}]}}},
            {'timestamp': '2026-10-19T10:00:02Z', 'type': 'event_msg', 'payload': {'type': 'item_completed',
             'item': {'type': 'FileChange', 'changes': {str(self.repo / 'do_codex.py'): {'type': 'add'}}}}},
        ])
        proj = home / '.claude/projects' / re.sub(r'[^A-Za-z0-9]', '-', str(self.repo))
        jsonl(proj / 'conversa-claude.jsonl', [
            {'type': 'user', 'timestamp': '2026-10-19T11:00:00Z', 'message': {'content': 'escreve o relatorio'}},
        ])
        # o subagente conta pra conversa que o chamou
        jsonl(proj / 'conversa-claude/subagents/agent-1.jsonl', [
            {'type': 'assistant', 'timestamp': '2026-10-19T11:00:05Z', 'message': {'content': [
                {'type': 'tool_use', 'name': 'Write', 'input': {'file_path': str(self.repo / 'do_claude.md')}}]}},
        ])
        env = dict(self.env, USERPROFILE=str(home), HOME=str(home))
        saida = subprocess.run([sys.executable, '-I', str(SCRIPT), str(self.repo)], env=env, check=True,
                               capture_output=True, text=True, encoding='utf-8').stdout
        self.assertIn('3 arquivos soltos no git:', saida)
        for trecho in ('codex 1', 'claude 1', 'comando 1', 'arruma o mapa', 'escreve o relatorio'):
            self.assertIn(trecho, saida)

    def commit(self, **env):
        hooks = self.repo / '.git' / 'hooks'
        shutil.copy(HOOK, hooks / 'prepare-commit-msg')
        arquivo = self.repo / 'a.txt'
        arquivo.write_text((arquivo.read_text() if arquivo.exists() else '') + 'x')
        git = ['git', '-C', str(self.repo), '-c', 'user.name=t', '-c', 'user.email=t@t']
        subprocess.run(git + ['add', '.'], check=True)
        subprocess.run(git + ['commit', '-q', '-m', 'teste'], check=True, env=dict(self.env, **env))
        return subprocess.run(git + ['log', '-1', '--format=%B'], check=True, capture_output=True,
                              text=True).stdout

    def test_hook_assina_so_quem_fez(self):
        self.assertNotIn('Co-Authored-By', self.commit())
        self.assertIn('Co-Authored-By: Codex', self.commit(PSModulePath=r'C:\x\codex-runtimes\pwsh\Modules'))
        self.assertIn('Co-Authored-By: Claude', self.commit(CLAUDECODE='1'))


if __name__ == '__main__':
    unittest.main()
