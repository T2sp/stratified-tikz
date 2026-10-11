import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createEmptyDiagram,createPointStratum} from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/constructors.ts';
import {updatePointNodeDimension,pointNodeLayoutIssues} from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/pointNodeLayout.ts';
import {validateDiagram} from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/validation.ts';
import {parseSavedDiagramJson,serializeDiagram} from '/Users/takamatoshinori/Desktop/stratified-tikz/src/model/serialization.ts';
import {generateTikz} from '/Users/takamatoshinori/Desktop/stratified-tikz/src/tikz/generateTikz.ts';
let results=[];for(const ambientDimension of [2,3])for(const [shape,anchor] of [['regular polygon','corner 1'],['star','outer point 1']]){
 const diagram=createEmptyDiagram({ambientDimension});const point=createPointStratum({ambientDimension,id:'review-negative-'+shape.replaceAll(' ','-'),position:{x:1,y:2,z:ambientDimension===3?3:0},text:''});point.style.shape=shape;for(const [fields,source] of [[['innerXSep','innerYSep'],'-30pt'],[['minimumWidth','minimumHeight'],'-20pt'],[['outerXSep','outerYSep'],'3pt']]){point.style=updatePointNodeDimension(point.style,fields,source);assert.ok(point.style);}point.style.layout.anchor=anchor;diagram.strata=[point];assert.deepEqual(pointNodeLayoutIssues(point.style.layout),[]);const issues=validateDiagram(diagram);const saved=serializeDiagram(diagram);const loaded=parseSavedDiagramJson(saved);assert.ok(loaded.ok);assert.deepEqual(loaded.diagram.strata[0].style.layout,point.style.layout);for(const exportMode of ['standalone','inlineMath']){
 const output=generateTikz(diagram,{exportMode});const path=`/private/tmp/stz-32d-geometry-review/${ambientDimension}d-${shape.replaceAll(' ','-')}-${exportMode}.tex`;writeFileSync(path,output);const node=output.match(/\\node\[[\s\S]*?\] at[^;]*;/)[0];results.push({ambientDimension,shape,anchor,issues,layout:point.style.layout,savedRoundTrip:true,path,node});}writeFileSync(`/private/tmp/stz-32d-geometry-review/${ambientDimension}d-${shape.replaceAll(' ','-')}.json`,saved);
}
writeFileSync('/private/tmp/stz-32d-geometry-review/model-paths-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
