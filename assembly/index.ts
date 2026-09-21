import { aes256Decrypt, aes256Encrypt, uidKey } from './crypto'
import { Nuan5JsonValidator } from './nuan5-json'

const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CAMERA_KEY:u8[]=[181,177,91,47,227,157,144,240,111,98,69,198,173,140,44,155,236,227,183,244,95,80,65,80,69,82,95,71,65,77,69,83]
export const Uint8Array_ID = idof<Uint8Array>()

function fail(code:string):string{return '{"ok":false,"errorCode":"'+code+'"}'}
function esc(s:string):string{return s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')}
function decode64(text:string):Uint8Array|null{
  if(text.length==0||text.length%4!=0)return null
  let pad=0;if(text.endsWith('=='))pad=2;else if(text.endsWith('='))pad=1
  const out=new Uint8Array(text.length/4*3-pad);let o=0
  for(let i=0;i<text.length;i+=4){let n:u32=0;for(let j=0;j<4;j++){const ch=text.charAt(i+j);let v=ch=='='?0:B64.indexOf(ch);if(v<0||(ch=='='&&i+j<text.length-pad))return null;n=(n<<6)|<u32>v}if(o<out.length)out[o++]=<u8>(n>>16);if(o<out.length)out[o++]=<u8>(n>>8);if(o<out.length)out[o++]=<u8>n}
  return out
}
function encode64(data:Uint8Array):string{let out='';for(let i=0;i<data.length;i+=3){const n=(<u32>data[i]<<16)|(<u32>(i+1<data.length?data[i+1]:0)<<8)|(i+2<data.length?data[i+2]:0);out+=B64.charAt((n>>18)&63)+B64.charAt((n>>12)&63)+(i+1<data.length?B64.charAt((n>>6)&63):'=')+(i+2<data.length?B64.charAt(n&63):'=')}return out}
function trimUtf8(bytes:Uint8Array):string|null{let n=bytes.indexOf(0);if(n<0)n=bytes.length;return String.UTF8.decode(bytes.slice(0,n).buffer,false)}
function findStringField(json:string,key:string):string|null{
  const token='"'+key+'"';let p=json.indexOf(token);if(p<0)return null;p=json.indexOf(':',p+token.length);if(p<0)return null;p++;while(p<json.length&&json.charCodeAt(p)<=32)p++;if(json.charAt(p)!='"')return null;p++;let out='';for(;p<json.length;p++){const c=json.charAt(p);if(c=='"')return out;if(c=='\\'&&p+1<json.length){p++;const e=json.charAt(p);out+=e=='n'?'\n':e=='r'?'\r':e=='t'?'\t':e}else out+=c}return null
}
function fieldStart(json:string,key:string):i32{const token='"'+key+'"';let p=json.indexOf(token);if(p<0)return -1;p=json.indexOf(':',p+token.length);if(p<0)return -1;p++;while(p<json.length&&json.charCodeAt(p)<=32)p++;return p}
function findNumberField(json:string,key:string):string|null{const p=fieldStart(json,key);if(p<0)return null;let e=p;while(e<json.length&&'-+0123456789.eE'.indexOf(json.charAt(e))>=0)e++;return e>p?json.substring(p,e):null}
function itemNumber(items:string[],index:i32):f64{return parseFloat(items[index])}
function itemString(items:string[],index:i32):string{const value=items[index];return value.startsWith('"')?value.substring(1,value.length-1):value}
function apertureDisplay(flag:string):string{const values:string[]=['','f/1.2','f/1.4','f/2','f/2.2','f/2.5','f/2.8','f/3.2','f/3.5','f/4','f/4.5','f/5','f/5.6','f/8','f/11','f/16'];const index=I32.parseInt(flag);return index>0&&index<values.length?values[index]:'f/?'}
function cameraJson(raw:string):string{
  const cipher=decode64(raw);if(cipher==null||cipher.length%16!=0)return fail('camera_base64_invalid')
  const key=new Uint8Array(32);for(let i=0;i<32;i++)key[i]=CAMERA_KEY[i];const text=trimUtf8(aes256Decrypt(cipher,key));if(text==null||!text.startsWith('['))return fail('camera_decrypt_failed')
  let count=0,quoted=false,escaped=false,depth=0;if(text.length>2)count=1
  for(let i=1;i<text.length-1;i++){const c=text.charAt(i);if(escaped){escaped=false;continue}if(c=='\\'&&quoted){escaped=true;continue}if(c=='"'){quoted=!quoted;continue}if(!quoted){if(c=='['||c=='{')depth++;else if(c==']'||c=='}')depth--;else if(c==','&&depth==0)count++}}
  if(count!=31&&count!=32&&count!=40)return fail('camera_params_invalid_length')
  const items=splitArray(text);if(items.length!=count)return fail('camera_params_invalid_length')
  let momo='null';if(count==32)momo='{"enabled":true}';else if(count==40)momo='{"enabled":false,"poseId":'+items[32]+',"horizontal":'+(itemNumber(items,33)*400).toString()+',"distance":'+(itemNumber(items,34)*400).toString()+',"height":'+(itemNumber(items,35)*400).toString()+',"rotation":'+(itemNumber(items,36)*180).toString()+',"autoGroundSnap":'+(items[37]=='1'?'true':'false')+',"floatingEffect":'+(items[38]=='1'?'true':'false')+',"poseWithNikki":'+(items[39]=='1'?'true':'false')+'}'
  return '{"ok":true,"value":{"version":"'+(count==31?'v1':'v2')+'","arrayLength":'+count.toString()+',"flag":'+items[0]+',"portraitMode":'+items[1]+',"cameraActorX":'+items[2]+',"cameraActorY":'+items[3]+',"cameraActorZ":'+items[4]+',"cameraActorPitch":'+items[5]+',"cameraActorYaw":'+items[6]+',"mode":'+items[7]+',"cameraComponentX":'+items[8]+',"cameraComponentY":'+items[9]+',"cameraComponentZ":'+items[10]+',"cameraComponentPitch":'+items[11]+',"cameraComponentYaw":'+items[12]+',"cameraActorRoll":'+items[13]+',"focalLength":'+items[14]+',"aperture":'+items[15]+',"apertureValue":"'+apertureDisplay(items[15])+'","cameraComponentRoll":'+items[16]+',"lightId":"'+esc(itemString(items,17))+'","lightStrength":'+items[18]+',"vignette":'+items[19]+',"bloomIntensity":'+(itemNumber(items,20)/8.0).toString()+',"bloomRange":'+items[21]+',"brightness":'+((itemNumber(items,22)-0.3)/1.2).toString()+',"exposure":'+items[23]+',"contrast":'+((itemNumber(items,24)-0.55)/1.45).toString()+',"saturation":'+items[25]+',"vibrance":'+(itemNumber(items,26)*2.0).toString()+',"highlights":'+items[27]+',"shadows":'+items[28]+',"filterId":"'+esc(itemString(items,29))+'","filterStrength":'+items[30]+',"light":{"id":"'+esc(itemString(items,17))+'","strength":'+items[18]+'},"filter":{"id":"'+esc(itemString(items,29))+'","strength":'+items[30]+'},"momo":'+momo+',"rawArray":'+text+'}}'
}
function splitArray(text:string):string[]{const out=new Array<string>(),startAt=1;let start=startAt,quoted=false,escaped=false,depth=0;for(let i=1;i<text.length-1;i++){const c=text.charAt(i);if(escaped){escaped=false;continue}if(c=='\\'&&quoted){escaped=true;continue}if(c=='"'){quoted=!quoted;continue}if(!quoted){if(c=='['||c=='{')depth++;else if(c==']'||c=='}')depth--;else if(c==','&&depth==0){out.push(text.substring(start,i).trim());start=i+1}}}if(text.length>2)out.push(text.substring(start,text.length-1).trim());return out}

export function decodeCameraParams(raw:string):string{return cameraJson(raw)}
export function validateNuan5Json(raw:string):bool{return new Nuan5JsonValidator(raw).validate()}

export function decodePhoto(photo:Uint8Array,uid:string):string{
  let first=-1,second=-1
  for(let i=0;i+1<photo.length;i++)if(photo[i]==255&&photo[i+1]==217){if(first<0){first=i;i++}else{second=i;break}}
  if(first<0)return fail('jpeg_tail_not_found');if(second<0)return fail('jpeg_second_end_marker_missing')
  let encoded='';for(let i=first+2;i<second;i++){if(photo[i]>127)return fail('base64_invalid');encoded+=String.fromCharCode(photo[i])}
  const cipher=decode64(encoded);if(cipher==null||cipher.length%16!=0)return fail('base64_invalid')
  const text=trimUtf8(aes256Decrypt(cipher,uidKey(uid)));if(text==null||!text.startsWith('{')||!new Nuan5JsonValidator(text).validate())return fail('photo_structure_invalid')
  if(text.indexOf('"SocialPhoto"')<0||text.indexOf('"PhotoInfo"')<0)return fail('photo_structure_invalid')
  const raw=findStringField(text,'CameraParams');if(raw==null||raw.length==0)return fail('camera_params_missing')
  const camera=cameraJson(raw);if(camera.indexOf('"ok":true')<0)return camera
  const focal=findNumberField(text,'cameraFocalLength'),aperture=findNumberField(text,'apertureSection'),vignette=findNumberField(text,'vignetteIntensity'),pose=findNumberField(text,'poseId'),lightId=findStringField(text,'lightId'),lightStrength=findNumberField(text,'lightStrength'),filterId=findStringField(text,'filterId'),filterStrength=findNumberField(text,'filterStrength'),hour=findNumberField(text,'hour'),minute=findNumberField(text,'min'),captureSecond=findNumberField(text,'sec'),weather=findNumberField(text,'WeatherType')
  const captureTime=hour!=null&&minute!=null&&captureSecond!=null?'"captureTime":{"hour":'+hour+',"minute":'+minute+',"second":'+captureSecond+'},':''
  return '{"ok":true,"value":{"rawCameraParams":"'+esc(raw)+'","photo":{'+captureTime+'"weatherType":'+(weather||'null')+',"focalLength":'+(focal||'null')+',"aperture":'+(aperture||'null')+',"apertureValue":"'+apertureDisplay(aperture||'-1')+'","vignette":'+(vignette||'null')+',"poseId":'+(pose||'null')+',"light":{"id":"'+esc(lightId||'None')+'","strength":'+(lightStrength||'0')+'},"filter":{"id":"'+esc(filterId||'None')+'","strength":'+(filterStrength||'0')+'}},"camera":'+camera.substring(camera.indexOf('{',12),camera.length-1)+'}}'
}

function replaceNumber(items:string[],index:i32,model:string,key:string,scale:f64=1.0,offset:f64=0.0):void{const value=findNumberField(model,key);if(value!=null)items[index]=(offset+parseFloat(value)*scale).toString()}
function replaceString(items:string[],index:i32,model:string,key:string):void{const value=findStringField(model,key);if(value!=null)items[index]='"'+esc(value)+'"'}
export function encodeCameraParams(model:string):string{
  const p=model.indexOf('['),end=model.lastIndexOf(']');if(p<0||end<p)return fail('camera_params_encode_failed');const items=splitArray(model.substring(p,end+1));if(items.length!=31&&items.length!=32&&items.length!=40)return fail('camera_params_invalid_length')
  replaceNumber(items,0,model,'flag');replaceNumber(items,1,model,'portraitMode');replaceNumber(items,2,model,'cameraActorX');replaceNumber(items,3,model,'cameraActorY');replaceNumber(items,4,model,'cameraActorZ');replaceNumber(items,5,model,'cameraActorPitch');replaceNumber(items,6,model,'cameraActorYaw');replaceNumber(items,7,model,'mode');replaceNumber(items,8,model,'cameraComponentX');replaceNumber(items,9,model,'cameraComponentY');replaceNumber(items,10,model,'cameraComponentZ');replaceNumber(items,11,model,'cameraComponentPitch');replaceNumber(items,12,model,'cameraComponentYaw');replaceNumber(items,13,model,'cameraActorRoll');replaceNumber(items,14,model,'focalLength');replaceNumber(items,15,model,'aperture');replaceNumber(items,16,model,'cameraComponentRoll');replaceString(items,17,model,'lightId');replaceNumber(items,18,model,'lightStrength');replaceNumber(items,19,model,'vignette');replaceNumber(items,20,model,'bloomIntensity',8);replaceNumber(items,21,model,'bloomRange');replaceNumber(items,22,model,'brightness',1.2,0.3);replaceNumber(items,23,model,'exposure');replaceNumber(items,24,model,'contrast',1.45,0.55);replaceNumber(items,25,model,'saturation');replaceNumber(items,26,model,'vibrance',0.5);replaceNumber(items,27,model,'highlights');replaceNumber(items,28,model,'shadows');replaceString(items,29,model,'filterId');replaceNumber(items,30,model,'filterStrength')
  if(items.length==40){replaceNumber(items,31,model,'momoEnabled');replaceNumber(items,32,model,'poseId');replaceNumber(items,33,model,'horizontal',0.0025);replaceNumber(items,34,model,'distance',0.0025);replaceNumber(items,35,model,'height',0.0025);replaceNumber(items,36,model,'rotation',1.0/180.0);replaceNumber(items,37,model,'autoGroundSnap');replaceNumber(items,38,model,'floatingEffect');replaceNumber(items,39,model,'poseWithNikki')}
  let raw='[';for(let i=0;i<items.length;i++){if(i)raw+=',';raw+=items[i]}raw+=']'
  const bytes=Uint8Array.wrap(String.UTF8.encode(raw,false)),padded=new Uint8Array((bytes.length+15)&~15);padded.set(bytes);const key=new Uint8Array(32);for(let i=0;i<32;i++)key[i]=CAMERA_KEY[i];return '{"ok":true,"value":"'+encode64(aes256Encrypt(padded,key))+'"}'
}
