import fs from 'node:fs';import validator from 'gltf-validator';
const path=new URL('../casa-vistalar-web-draco.glb',import.meta.url);
const report=await validator.validateBytes(new Uint8Array(fs.readFileSync(path)),{uri:'casa-vistalar-web-draco.glb',maxIssues:100});
fs.writeFileSync(new URL('../gltf-validation.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({errors:report.issues.numErrors,warnings:report.issues.numWarnings,info:report.issues.numInfos,messages:report.issues.messages.slice(0,8)}));
if(report.issues.numErrors)process.exitCode=1;
