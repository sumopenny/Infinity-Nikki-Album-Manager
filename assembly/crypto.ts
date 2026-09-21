const SBOX: u8[] = [
  99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22
]
const INV = new Array<u8>(256)
for (let i = 0; i < 256; i++) INV[SBOX[i]] = <u8>i
const RCON: u8[] = [1,2,4,8,16,32,64,128,27,54]

function gm(a: u8, b: u8): u8 {
  let x = a, y = b, r: u8 = 0
  while (y) { if (y & 1) r ^= x; x = <u8>((x << 1) ^ ((x & 0x80) ? 0x11b : 0)); y >>= 1 }
  return r
}

function expandKey(key: Uint8Array): Uint8Array {
  const out = new Uint8Array(240)
  out.set(key)
  let used = 32, rc = 0
  const t = new Uint8Array(4)
  while (used < 240) {
    for (let i = 0; i < 4; i++) t[i] = out[used - 4 + i]
    if (used % 32 == 0) {
      const q = t[0]; t[0] = SBOX[t[1]] ^ RCON[rc++]; t[1] = SBOX[t[2]]; t[2] = SBOX[t[3]]; t[3] = SBOX[q]
    } else if (used % 32 == 16) {
      for (let i = 0; i < 4; i++) t[i] = SBOX[t[i]]
    }
    for (let i = 0; i < 4; i++) { out[used] = out[used - 32] ^ t[i]; used++ }
  }
  return out
}

function addRoundKey(s: Uint8Array, k: Uint8Array, offset: i32): void { for (let i = 0; i < 16; i++) s[i] ^= k[offset + i] }
function invShiftRows(s: Uint8Array): void {
  let t = s[13]; s[13]=s[9]; s[9]=s[5]; s[5]=s[1]; s[1]=t
  t=s[2]; s[2]=s[10]; s[10]=t; t=s[6]; s[6]=s[14]; s[14]=t
  t=s[3]; s[3]=s[7]; s[7]=s[11]; s[11]=s[15]; s[15]=t
}
function invMix(s: Uint8Array): void {
  for (let c=0;c<4;c++) { const i=c*4,a=s[i],b=s[i+1],d=s[i+2],e=s[i+3]; s[i]=gm(a,14)^gm(b,11)^gm(d,13)^gm(e,9); s[i+1]=gm(a,9)^gm(b,14)^gm(d,11)^gm(e,13); s[i+2]=gm(a,13)^gm(b,9)^gm(d,14)^gm(e,11); s[i+3]=gm(a,11)^gm(b,13)^gm(d,9)^gm(e,14) }
}

export function aes256Decrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const keys=expandKey(key), out=new Uint8Array(data.length), s=new Uint8Array(16)
  for (let p=0;p<data.length;p+=16) {
    for(let i=0;i<16;i++) s[i]=data[p+i]
    addRoundKey(s,keys,224)
    for(let round=13;round>0;round--){ invShiftRows(s); for(let i=0;i<16;i++)s[i]=INV[s[i]]; addRoundKey(s,keys,round*16); invMix(s) }
    invShiftRows(s); for(let i=0;i<16;i++)s[i]=INV[s[i]]; addRoundKey(s,keys,0)
    for(let i=0;i<16;i++)out[p+i]=s[i]
  }
  return out
}

function shiftRows(s:Uint8Array):void{let t=s[1];s[1]=s[5];s[5]=s[9];s[9]=s[13];s[13]=t;t=s[2];s[2]=s[10];s[10]=t;t=s[6];s[6]=s[14];s[14]=t;t=s[3];s[3]=s[15];s[15]=s[11];s[11]=s[7];s[7]=t}
function mix(s:Uint8Array):void{for(let c=0;c<4;c++){const i=c*4,a=s[i],b=s[i+1],d=s[i+2],e=s[i+3];s[i]=gm(a,2)^gm(b,3)^d^e;s[i+1]=a^gm(b,2)^gm(d,3)^e;s[i+2]=a^b^gm(d,2)^gm(e,3);s[i+3]=gm(a,3)^b^d^gm(e,2)}}
export function aes256Encrypt(data:Uint8Array,key:Uint8Array):Uint8Array{const keys=expandKey(key),out=new Uint8Array(data.length),s=new Uint8Array(16);for(let p=0;p<data.length;p+=16){for(let i=0;i<16;i++)s[i]=data[p+i];addRoundKey(s,keys,0);for(let round=1;round<14;round++){for(let i=0;i<16;i++)s[i]=SBOX[s[i]];shiftRows(s);mix(s);addRoundKey(s,keys,round*16)}for(let i=0;i<16;i++)s[i]=SBOX[s[i]];shiftRows(s);addRoundKey(s,keys,224);for(let i=0;i<16;i++)out[p+i]=s[i]}return out}

function rol(v:u32,n:i32):u32{return (v<<n)|(v>>(32-n))}
export function sha1(data: Uint8Array): Uint8Array {
  const size=((data.length+9+63)/64)*64, msg=new Uint8Array(size); msg.set(data); msg[data.length]=0x80
  const bits=<u64>data.length*8; for(let i=0;i<8;i++)msg[size-1-i]=<u8>(bits>>(i*8))
  let h0:u32=0x67452301,h1:u32=0xefcdab89,h2:u32=0x98badcfe,h3:u32=0x10325476,h4:u32=0xc3d2e1f0
  const w=new Array<u32>(80)
  for(let p=0;p<size;p+=64){ for(let i=0;i<16;i++){const q=p+i*4;w[i]=(<u32>msg[q]<<24)|(<u32>msg[q+1]<<16)|(<u32>msg[q+2]<<8)|msg[q+3]} for(let i=16;i<80;i++)w[i]=rol(w[i-3]^w[i-8]^w[i-14]^w[i-16],1)
    let a=h0,b=h1,c=h2,d=h3,e=h4
    for(let i=0;i<80;i++){let f:u32=0,k:u32=0;if(i<20){f=(b&c)|((~b)&d);k=0x5a827999}else if(i<40){f=b^c^d;k=0x6ed9eba1}else if(i<60){f=(b&c)|(b&d)|(c&d);k=0x8f1bbcdc}else{f=b^c^d;k=0xca62c1d6}const z=rol(a,5)+f+e+k+w[i];e=d;d=c;c=rol(b,30);b=a;a=z} h0+=a;h1+=b;h2+=c;h3+=d;h4+=e }
  const out=new Uint8Array(20), hs:u32[]=[h0,h1,h2,h3,h4]; for(let i=0;i<5;i++)for(let j=0;j<4;j++)out[i*4+j]=<u8>(hs[i]>>(24-j*8)); return out
}

export function uidKey(uid:string):Uint8Array { const raw=new Uint8Array(uid.length*2);for(let i=0;i<uid.length;i++){const c=uid.charCodeAt(i);raw[i*2]=<u8>c;raw[i*2+1]=<u8>(c>>8)} const h=sha1(raw),out=new Uint8Array(32),suffix=String.UTF8.encode('_PAPER_GAMES',false);out.set(h);out.set(Uint8Array.wrap(suffix),20);return out }
