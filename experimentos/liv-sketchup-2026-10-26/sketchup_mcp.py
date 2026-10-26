"""Executa as ferramentas da ponte local do SketchUp e guarda suas imagens."""
import argparse
import asyncio
import base64
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def run(args):
    params = StdioServerParameters(
        command=r"C:\Users\respawn\.local\bin\uvx.exe",
        args=["--python", "3.11.16", "sketchup-mcp2"],
        env=dict(os.environ, SKETCHUP_MCP_HOST="127.0.0.1",
                 SKETCHUP_MCP_PORT="9877", SKETCHUP_MCP_TIMEOUT="180"),
    )
    async with stdio_client(params) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            if args.describe:
                catalog = await session.list_tools()
                for tool in catalog.tools:
                    if tool.name in args.describe.split(","):
                        print(tool.model_dump_json(), flush=True)
                return
            payload = json.loads(args.args)
            tool = args.tool
            if args.code:
                payload = {"code": args.code}
                tool = "eval_ruby"
            if args.ruby:
                path = Path(args.ruby).resolve().as_posix()
                payload = {"code": "load " + json.dumps(path) + "; $liv_result.to_json"}
                tool = "eval_ruby"
            result = await session.call_tool(tool, payload)
            for index, item in enumerate(result.content):
                if item.type == "image":
                    output = Path(args.image or f"sketchup-{index}.png")
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_bytes(base64.b64decode(item.data))
                    print("IMAGEM: " + str(output.resolve()), flush=True)
                elif item.type == "text":
                    print(item.text, flush=True)
                    if tool == "eval_ruby" and item.text.startswith("[-"):
                        raise RuntimeError(item.text)
            if result.isError:
                raise RuntimeError("A ferramenta " + tool + " retornou erro")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tool", default="get_model_info")
    parser.add_argument("--args", default="{}")
    parser.add_argument("--ruby")
    parser.add_argument("--code")
    parser.add_argument("--describe")
    parser.add_argument("--image")
    options = parser.parse_args()
    asyncio.run(asyncio.wait_for(run(options), timeout=240))
