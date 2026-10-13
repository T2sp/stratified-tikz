/** Actual production source with independent PGF compilation/domain observations.
 * Imports serialization/options only; no runtime geometry or classifier. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmptyDiagram, createPointStratum, createSheetStratum } from '../../../../src/model/constructors.ts'
import { updatePointNodeDimension } from '../../../../src/model/pointNodeLayout.ts'
import { importTikzStyleFile } from '../../../../src/model/importedTikzStyles.ts'
import { applyUserStylePresetToStratum } from '../../../../src/model/stylePresets.ts'
import { defaultVisibilityOptions } from '../../../../src/model/visibility.ts'
import { serializeDiagram } from '../../../../src/model/serialization.ts'
import { applyContextQuickStylePreset } from '../../../../src/ui/contextQuickStyleBar.ts'
import { generateTikz } from '../../../../src/tikz/generateTikz.ts'
const output=fileURLToPath(new URL('.',import.meta.url))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const priorBytes=readFileSync(join(output,'../cylinder-fitting-scanning/references.json'))
const prior=JSON.parse(priorBytes)
for(const [file,expected] of Object.entries(prior.sourceHashes))assert.equal(hash(readFileSync(file)),expected,file)
const engine='/Library/TeX/texbin/pdflatex'
const engineVersion=execFileSync(engine,['--version'],{encoding:'utf8'}).split('\n')[0]
assert.equal(engineVersion,prior.engine)
const outputHashes={}
function retain(file,bytes){writeFileSync(join(output,file),bytes);outputHashes[file]=hash(bytes)}
retain('.gitignore','# Retain compiler logs in the exact authenticated checkout inventory.\n!**/*.log\n')
const raw=String.raw`\tikzset{tinyCylinder/.style={cylinder,inner xsep=0pt,inner ysep=0.0000074em,outer sep=0pt,minimum width=0pt,minimum height=80pt}}`
const rawEx=raw.replace('0.0000074em','0.0000074ex')
const cases=[
 {id:'local-em',source:'0.0000074em',expectedDivisorSp:5,expectedExit:0},
 {id:'inherited-legacy-em',source:'0.0000074em',imported:true,removeLayoutIntent:true,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'inherited-current-source',source:'0.0000074em',imported:true,rawCurrent:raw.replace('0.0000074em','1pt'),expectedDivisorSp:65536,expectedExit:0},
 {id:'inherited-preset-fallback',source:'0.0000074em',imported:true,presetOnly:true,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'source-rotate90',source:'1pt',imported:true,rawInitial:raw.replace('0.0000074em','1pt'),rawCurrent:raw.replace('0.0000074em','1pt').replace('cylinder,','cylinder,shape border rotate=90,'),domainRotate:90,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'source-rotate270',source:'1pt',imported:true,rawInitial:raw.replace('0.0000074em','1pt'),rawCurrent:raw.replace('0.0000074em','1pt').replace('cylinder,','cylinder,shape border rotate=270,'),domainRotate:270,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'source-incircle-disabled',source:'0pt',imported:true,rawInitial:raw.replace('0.0000074em','0pt').replace('inner xsep=0pt','inner xsep=5pt').replace('cylinder,','cylinder,shape border uses incircle=true,'),rawCurrent:raw.replace('0.0000074em','0pt').replace('inner xsep=0pt','inner xsep=5pt').replace('cylinder,','cylinder,shape border uses incircle=false,'),domainIncircle:false,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'dimmed-preset-only',source:'0.0000074em',imported:true,presetOnly:true,dimPreset:true,ambientDimensions:[3],expectedDivisorSp:5,expectedExit:0},
 {id:'inherited-em',source:'0.0000074em',imported:true,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'detached-em',source:'0.0000074em',imported:true,detach:true,expectedDivisorSp:5,expectedExit:0},
 {id:'same-value-local-edit-em',source:'0.0000074em',imported:true,edit:'0.0000074em',expectedDivisorSp:5,expectedExit:0},
 {id:'inferred-numeric-change-em',source:'0.0000074em',imported:true,edit:'0.000009em',removeRecordedOverride:true,expectedDivisorSp:6,expectedExit:0},
 {id:'local-pt-roundup',source:'0.0000076pt',expectedDivisorSp:1,expectedExit:1,expectedError:'Dimension too large'},
 {id:'local-pt-rounddown',source:'0.0000074pt',expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
 {id:'local-negative-em',source:'-0.0000074em',signed:true,expectedDivisorSp:-5,expectedExit:0},
 {id:'local-ex-recorded-context',source:'0.0000074ex',fontContext:{fontSizePt:30,xHeightPt:20},expectedDivisorSp:10,expectedExit:0},
 {id:'inherited-ex',source:'0.0000074ex',imported:true,expectedDivisorSp:0,expectedExit:1,expectedError:"You've asked me to divide"},
]
function model(value,ambientDimension){
 let diagram=createEmptyDiagram({ambientDimension})
 let style={...createPointStratum({ambientDimension,id:'p',position:{x:0,y:0,z:0}}).style,shape:'cylinder',layout:{fontContext:value.fontContext??{fontSizePt:10,xHeightPt:4.30554}}}
 for(const [field,source] of Object.entries({innerXSep:'0pt',innerYSep:value.source,outerXSep:'0pt',outerYSep:'0pt',minimumWidth:value.signed?'-20pt':'0pt',minimumHeight:value.signed?'-20pt':'80pt'})){
  style=updatePointNodeDimension(style,[field],source);assert.ok(style)
 }
 diagram.strata=[createPointStratum({ambientDimension,id:'p',text:'',position:{x:0,y:0,z:0},style})]
 if(value.imported){
  const imported=importTikzStyleFile(diagram,'tiny-cylinder.sty',value.rawInitial ?? (value.source.endsWith('ex')?rawEx:raw))
  const preset=imported.diagram.userStylePresets.find(value=>value.kind==='point');assert.ok(preset)
  diagram=applyUserStylePresetToStratum(imported.diagram,'p',preset.id)
  if(value.edit){diagram.strata[0].style=updatePointNodeDimension(diagram.strata[0].style,['innerYSep'],value.edit);assert.ok(diagram.strata[0].style)}
  if(value.removeRecordedOverride)diagram.strata[0].style.importedLayout.overriddenFields=[]
  if(value.removeLayoutIntent)delete diagram.strata[0].style.importedLayout
  if(value.presetOnly){delete diagram.strata[0].importedTikzStyleReferenceId;for(const style of [diagram.strata[0].style,diagram.userStylePresets.find(value=>value.kind==='point').style]){delete style.importedLayout;delete style.importedShape;delete style.importedPaint}}
  if(value.rawCurrent)diagram.externalTikzStyleSources[0].rawSource=value.rawCurrent
  if(value.dimPreset){diagram.camera={...diagram.camera,thetaDeg:90,phiDeg:0};diagram.view={...diagram.view,camera3d:diagram.camera,visibility:{...defaultVisibilityOptions,enabled:true,pointVisibility:'dimHidden'}};diagram.strata[0].position={x:0,y:-1,z:0};diagram.strata.push(createSheetStratum({id:'occluding-sheet',corners:[{x:-1,y:0,z:-1},{x:1,y:0,z:-1},{x:1,y:0,z:1},{x:-1,y:0,z:1}]}))}
  if(value.detach){const cleared=applyContextQuickStylePreset(diagram,{kind:'stratum',id:'p'},null);assert.ok(cleared.ok);diagram=cleared.diagram}
 }
 return diagram
}
const work=mkdtempSync(join(tmpdir(),'stz-cylinder-export-domain-pgf-'))
const records=[]
for(const value of cases)for(const ambientDimension of value.ambientDimensions ?? [2,3]){
 const diagram=model(value,ambientDimension),id=`${value.id}-${ambientDimension}d`,directory=join(output,id)
 mkdirSync(directory,{recursive:true})
 const artifacts={model:`${id}/model.json`};retain(artifacts.model,serializeDiagram(diagram))
 const runs=[]
 for(const exportMode of ['standalone','inlineMath']){
  const path=join(work,`${id}-${exportMode}`);mkdirSync(path)
  const source=generateTikz(diagram,{exportMode}),external=value.imported?diagram.externalTikzStyleSources[0].rawSource:undefined
  if(external){writeFileSync(join(path,'tiny-cylinder.sty'),external);artifacts.externalSource=`${id}/tiny-cylinder.sty`;retain(artifacts.externalSource,external)}
  const instrument=String.raw`\makeatletter
\newwrite\domainout\immediate\openout\domainout=domain.txt
\let\originaldivide\pgfmathdivide@
\def\pgfmathdivide@#1#2{\immediate\write\domainout{DIVIDE #1; #2}\originaldivide{#1}{#2}}
\makeatother`
  const wrapped='\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage{tikz-3dplot}\n\\usetikzlibrary{shapes.geometric,shapes.symbols}\n\\typeout{STZ PGF VERSION \\pgfversion}\n'+(external?'\\input{tiny-cylinder.sty}\n':'')+'\\begin{document}\n'+instrument+'\n'+source+'\n\\end{document}\n'
  writeFileSync(join(path,'actual-generated-wrapped.tex'),wrapped)
  const args=['-no-shell-escape','-interaction=nonstopmode','-halt-on-error','actual-generated-wrapped.tex']
  const execution=spawnSync(engine,args,{cwd:path,encoding:'utf8',maxBuffer:8e6})
  assert.equal(execution.status,value.expectedExit,`${id}/${exportMode}: ${execution.stdout}`)
  if(value.expectedError)assert.ok(execution.stdout.includes(value.expectedError),id)
  const domain=readFileSync(join(path,'domain.txt'),'utf8')
  const first=/^DIVIDE ([^;]+); ([^\n]+)$/m.exec(domain);assert.ok(first,domain)
  const observedDivisorSp=Math.round(Number(first[2])*65536)
  assert.equal(observedDivisorSp,value.expectedDivisorSp,`${id}/${exportMode}: ${domain}`)
  const files={source:`${id}/${exportMode}-generated.tex`,wrapper:`${id}/${exportMode}-wrapped.tex`,domain:`${id}/${exportMode}-domain.txt`,compilation:`${id}/${exportMode}-compilation.txt`,compilerLog:`${id}/${exportMode}-compiler.log`}
  for(const [key,bytes] of [['source',source],['wrapper',wrapped],['domain',domain],['compilation',execution.stdout],['compilerLog',readFileSync(join(path,'actual-generated-wrapped.log'))]])retain(files[key],bytes)
  runs.push({exportMode,exitCode:execution.status,command:[engine,...args],observedDivisorSp,firstDivide:{numerator:first[1],divisor:first[2]},artifacts:files})
 }
 records.push({...value,id,ambientDimension,artifacts,runs})
}
const applicationSourceHashes={}
for(const file of ['src/tikz/generateTikz.ts','src/model/pointNodeLayout.ts','src/model/importedTikzStyles.ts','src/model/stylePresets.ts','src/model/styles.ts','src/model/serialization.ts','src/model/constructors.ts','src/model/visibility.ts','src/ui/contextQuickStyleBar.ts'])applicationSourceHashes[file]=hash(readFileSync(new URL(`../../../../${file}`,import.meta.url)))
const references={schema:'stz-pgf-cylinder-actual-export-domain-v1',pgfVersion:'3.1.11a',engine:engineVersion,engineBinarySha256:hash(readFileSync(engine)),sourceHashes:prior.sourceHashes,priorReferenceSha256:hash(priorBytes),generatorSha256:hash(readFileSync(fileURLToPath(import.meta.url))),applicationSourceHashes,units:'TeX pt; raw observed PGF division arguments converted to signed integer scaled points. Actual generated source/model/external raw style bytes are immutable; no runtime geometry was used to create expectations.',artifactHashes:outputHashes,records}
writeFileSync(join(output,'references.json'),JSON.stringify(references,null,2)+'\n')
console.log(JSON.stringify({result:'generated',records:records.length,actualCompilerRuns:records.length*2,work}))
