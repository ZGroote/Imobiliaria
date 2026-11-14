/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var th=()=>{};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var rh=function(r){let e=[],t=0;for(let n=0;n<r.length;n++){let s=r.charCodeAt(n);s<128?e[t++]=s:s<2048?(e[t++]=s>>6|192,e[t++]=s&63|128):(s&64512)===55296&&n+1<r.length&&(r.charCodeAt(n+1)&64512)===56320?(s=65536+((s&1023)<<10)+(r.charCodeAt(++n)&1023),e[t++]=s>>18|240,e[t++]=s>>12&63|128,e[t++]=s>>6&63|128,e[t++]=s&63|128):(e[t++]=s>>12|224,e[t++]=s>>6&63|128,e[t++]=s&63|128)}return e},mp=function(r){let e=[],t=0,n=0;for(;t<r.length;){let s=r[t++];if(s<128)e[n++]=String.fromCharCode(s);else if(s>191&&s<224){let i=r[t++];e[n++]=String.fromCharCode((s&31)<<6|i&63)}else if(s>239&&s<365){let i=r[t++],a=r[t++],B=r[t++],u=((s&7)<<18|(i&63)<<12|(a&63)<<6|B&63)-65536;e[n++]=String.fromCharCode(55296+(u>>10)),e[n++]=String.fromCharCode(56320+(u&1023))}else{let i=r[t++],a=r[t++];e[n++]=String.fromCharCode((s&15)<<12|(i&63)<<6|a&63)}}return e.join("")},sh={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(r,e){if(!Array.isArray(r))throw Error("encodeByteArray takes an array as a parameter");this.init_();let t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,n=[];for(let s=0;s<r.length;s+=3){let i=r[s],a=s+1<r.length,B=a?r[s+1]:0,u=s+2<r.length,l=u?r[s+2]:0,f=i>>2,C=(i&3)<<4|B>>4,D=(B&15)<<2|l>>6,v=l&63;u||(v=64,a||(D=64)),n.push(t[f],t[C],t[D],t[v])}return n.join("")},encodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(r):this.encodeByteArray(rh(r),e)},decodeString(r,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(r):mp(this.decodeStringToByteArray(r,e))},decodeStringToByteArray(r,e){this.init_();let t=e?this.charToByteMapWebSafe_:this.charToByteMap_,n=[];for(let s=0;s<r.length;){let i=t[r.charAt(s++)],B=s<r.length?t[r.charAt(s)]:0;++s;let l=s<r.length?t[r.charAt(s)]:64;++s;let C=s<r.length?t[r.charAt(s)]:64;if(++s,i==null||B==null||l==null||C==null)throw new ia;let D=i<<2|B>>4;if(n.push(D),l!==64){let v=B<<4&240|l>>2;if(n.push(v),C!==64){let R=l<<6&192|C;n.push(R)}}}return n},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let r=0;r<this.ENCODED_VALS.length;r++)this.byteToCharMap_[r]=this.ENCODED_VALS.charAt(r),this.charToByteMap_[this.byteToCharMap_[r]]=r,this.byteToCharMapWebSafe_[r]=this.ENCODED_VALS_WEBSAFE.charAt(r),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[r]]=r,r>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(r)]=r,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(r)]=r)}}},ia=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},Ep=function(r){let e=rh(r);return sh.encodeByteArray(e,!0)},zr=function(r){return Ep(r).replace(/\./g,"")},ih=function(r){try{return sh.decodeString(r,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oh(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var _p=()=>oh().__FIREBASE_DEFAULTS__,Dp=()=>{if(typeof process>"u"||typeof process.env>"u")return;let r=process.env.__FIREBASE_DEFAULTS__;if(r)return JSON.parse(r)},yp=()=>{if(typeof document>"u")return;let r;try{r=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let e=r&&ih(r[1]);return e&&JSON.parse(e)},oa=()=>{try{return th()||_p()||Dp()||yp()}catch(r){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${r}`);return}},wp=r=>oa()?.emulatorHosts?.[r],ah=r=>{let e=wp(r);if(!e)return;let t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);let n=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),n]:[e.substring(0,t),n]},aa=()=>oa()?.config;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var hi=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,n)=>{t?this.reject(t):this.resolve(n),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,n))}}};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bh(r,e){if(r.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');let t={alg:"none",type:"JWT"},n=e||"demo-project",s=r.iat||0,i=r.sub||r.user_id;if(!i)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");let a={iss:`https://securetoken.google.com/${n}`,aud:n,iat:s,exp:s+3600,auth_time:s,sub:i,user_id:i,firebase:{sign_in_provider:"custom",identities:{}},...r};return[zr(JSON.stringify(t)),zr(JSON.stringify(a)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function uh(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Ip(){let r=oa()?.forceEnvironment;if(r==="node")return!0;if(r==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function ch(){return!Ip()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Ba(){try{return typeof indexedDB=="object"}catch{return!1}}function lh(){return new Promise((r,e)=>{try{let t=!0,n="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(n);s.onsuccess=()=>{s.result.close(),t||self.indexedDB.deleteDatabase(n),r(!0)},s.onupgradeneeded=()=>{t=!1},s.onerror=()=>{e(s.error?.message||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Tp="FirebaseError",yt=class r extends Error{constructor(e,t,n){super(t),this.code=e,this.customData=n,this.name=Tp,Object.setPrototypeOf(this,r.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Qr.prototype.create)}},Qr=class{constructor(e,t,n){this.service=e,this.serviceName=t,this.errors=n}create(e,...t){let n=t[0]||{},s=`${this.service}/${e}`,i=this.errors[e],a=i?Ap(i,n):"Error",B=`${this.serviceName}: ${a} (${s}).`;return new yt(s,B,n)}};function Ap(r,e){try{let t=0,n="";for(;t<r.length;){let s=r.indexOf("{$",t);if(s===-1){n+=r.substring(t);break}let i=r.indexOf("}",s+2);if(i===-1){n+=r.substring(t);break}let a=r.substring(s+2,i),B=e[a];n+=r.substring(t,s)+(B!=null?String(B):`<${a}?>`),t=i+1}return n}catch{return r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Cn(r,e){if(r===e)return!0;let t=Object.keys(r),n=Object.keys(e);for(let s of t){if(!n.includes(s))return!1;let i=r[s],a=e[s];if(nh(i)&&nh(a)){if(!Cn(i,a))return!1}else if(i!==a)return!1}for(let s of n)if(!t.includes(s))return!1;return!0}function nh(r){return r!==null&&typeof r=="object"}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var __=14400*1e3;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Kt(r){return r&&r._delegate?r._delegate:r}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ua(r){try{return(r.startsWith("http://")||r.startsWith("https://")?new URL(r).hostname:r).endsWith(".cloudworkstations.dev")}catch{return!1}}async function hh(r){return(await fetch(r,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var wt=class{constructor(e,t,n){this.name=e,this.instanceFactory=t,this.type=n,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var pn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ca=class{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){let t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){let n=new hi;if(this.instancesDeferred.set(t,n),this.isInitialized(t)||this.shouldAutoInitialize())try{let s=this.getOrInitializeService({instanceIdentifier:t});s&&n.resolve(s)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){let t=this.normalizeInstanceIdentifier(e?.identifier),n=e?.optional??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(s){if(n)return null;throw s}else{if(n)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(vp(e))try{this.getOrInitializeService({instanceIdentifier:pn})}catch{}for(let[t,n]of this.instancesDeferred.entries()){let s=this.normalizeInstanceIdentifier(t);try{let i=this.getOrInitializeService({instanceIdentifier:s});n.resolve(i)}catch{}}}}clearInstance(e=pn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){let e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=pn){return this.instances.has(e)}getOptions(e=pn){return this.instancesOptions.get(e)||{}}initialize(e={}){let{options:t={}}=e,n=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(n))throw Error(`${this.name}(${n}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let s=this.getOrInitializeService({instanceIdentifier:n,options:t});for(let[i,a]of this.instancesDeferred.entries()){let B=this.normalizeInstanceIdentifier(i);n===B&&a.resolve(s)}return s}onInit(e,t){let n=this.normalizeInstanceIdentifier(t),s=this.onInitCallbacks.get(n)??new Set;s.add(e),this.onInitCallbacks.set(n,s);let i=this.instances.get(n);return i&&e(i,n),()=>{s.delete(e)}}invokeOnInitCallbacks(e,t){let n=this.onInitCallbacks.get(t);if(n)for(let s of n)try{s(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let n=this.instances.get(e);if(!n&&this.component&&(n=this.component.instanceFactory(this.container,{instanceIdentifier:bp(e),options:t}),this.instances.set(e,n),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(n,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,n)}catch{}return n||null}normalizeInstanceIdentifier(e=pn){return this.component?this.component.multipleInstances?e:pn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};function bp(r){return r===pn?void 0:r}function vp(r){return r.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var fi=class{constructor(e){this.name=e,this.providers=new Map}addComponent(e){let t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);let t=new ca(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Sp=[],se;(function(r){r[r.DEBUG=0]="DEBUG",r[r.VERBOSE=1]="VERBOSE",r[r.INFO=2]="INFO",r[r.WARN=3]="WARN",r[r.ERROR=4]="ERROR",r[r.SILENT=5]="SILENT"})(se||(se={}));var Rp={debug:se.DEBUG,verbose:se.VERBOSE,info:se.INFO,warn:se.WARN,error:se.ERROR,silent:se.SILENT},Np=se.INFO,Fp={[se.DEBUG]:"log",[se.VERBOSE]:"log",[se.INFO]:"info",[se.WARN]:"warn",[se.ERROR]:"error"},xp=(r,e,...t)=>{if(e<r.logLevel)return;let n=new Date().toISOString(),s=Fp[e];if(s)console[s](`[${n}]  ${r.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)},Hn=class{constructor(e){this.name=e,this._logLevel=Np,this._logHandler=xp,this._userLogHandler=null,Sp.push(this)}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in se))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Rp[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,se.DEBUG,...e),this._logHandler(this,se.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,se.VERBOSE,...e),this._logHandler(this,se.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,se.INFO,...e),this._logHandler(this,se.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,se.WARN,...e),this._logHandler(this,se.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,se.ERROR,...e),this._logHandler(this,se.ERROR,...e)}};var Pp=(r,e)=>e.some(t=>r instanceof t),fh,dh;function Op(){return fh||(fh=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Lp(){return dh||(dh=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}var Ch=new WeakMap,ha=new WeakMap,ph=new WeakMap,la=new WeakMap,da=new WeakMap;function Vp(r){let e=new Promise((t,n)=>{let s=()=>{r.removeEventListener("success",i),r.removeEventListener("error",a)},i=()=>{t(gt(r.result)),s()},a=()=>{n(r.error),s()};r.addEventListener("success",i),r.addEventListener("error",a)});return e.then(t=>{t instanceof IDBCursor&&Ch.set(t,r)}).catch(()=>{}),da.set(e,r),e}function kp(r){if(ha.has(r))return;let e=new Promise((t,n)=>{let s=()=>{r.removeEventListener("complete",i),r.removeEventListener("error",a),r.removeEventListener("abort",a)},i=()=>{t(),s()},a=()=>{n(r.error||new DOMException("AbortError","AbortError")),s()};r.addEventListener("complete",i),r.addEventListener("error",a),r.addEventListener("abort",a)});ha.set(r,e)}var fa={get(r,e,t){if(r instanceof IDBTransaction){if(e==="done")return ha.get(r);if(e==="objectStoreNames")return r.objectStoreNames||ph.get(r);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return gt(r[e])},set(r,e,t){return r[e]=t,!0},has(r,e){return r instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in r}};function gh(r){fa=r(fa)}function Mp(r){return r===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){let n=r.call(di(this),e,...t);return ph.set(n,e.sort?e.sort():[e]),gt(n)}:Lp().includes(r)?function(...e){return r.apply(di(this),e),gt(Ch.get(this))}:function(...e){return gt(r.apply(di(this),e))}}function Gp(r){return typeof r=="function"?Mp(r):(r instanceof IDBTransaction&&kp(r),Pp(r,Op())?new Proxy(r,fa):r)}function gt(r){if(r instanceof IDBRequest)return Vp(r);if(la.has(r))return la.get(r);let e=Gp(r);return e!==r&&(la.set(r,e),da.set(e,r)),e}var di=r=>da.get(r);function Eh(r,e,{blocked:t,upgrade:n,blocking:s,terminated:i}={}){let a=indexedDB.open(r,e),B=gt(a);return n&&a.addEventListener("upgradeneeded",u=>{n(gt(a.result),u.oldVersion,u.newVersion,gt(a.transaction),u)}),t&&a.addEventListener("blocked",u=>t(u.oldVersion,u.newVersion,u)),B.then(u=>{i&&u.addEventListener("close",()=>i()),s&&u.addEventListener("versionchange",l=>s(l.oldVersion,l.newVersion,l))}).catch(()=>{}),B}var Hp=["get","getKey","getAll","getAllKeys","count"],Up=["put","add","delete","clear"],Ca=new Map;function mh(r,e){if(!(r instanceof IDBDatabase&&!(e in r)&&typeof e=="string"))return;if(Ca.get(e))return Ca.get(e);let t=e.replace(/FromIndex$/,""),n=e!==t,s=Up.includes(t);if(!(t in(n?IDBIndex:IDBObjectStore).prototype)||!(s||Hp.includes(t)))return;let i=async function(a,...B){let u=this.transaction(a,s?"readwrite":"readonly"),l=u.store;return n&&(l=l.index(B.shift())),(await Promise.all([l[t](...B),s&&u.done]))[0]};return Ca.set(e,i),i}gh(r=>({...r,get:(e,t,n)=>mh(e,t)||r.get(e,t,n),has:(e,t)=>!!mh(e,t)||r.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ga=class{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(qp(t)){let n=t.getImmediate();return`${n.library}/${n.version}`}else return null}).filter(t=>t).join(" ")}};function qp(r){return r.getComponent()?.type==="VERSION"}var ma="@firebase/app",_h="0.16.1";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Tt=new Hn("@firebase/app"),jp="@firebase/app-compat",Jp="@firebase/analytics-compat",Kp="@firebase/analytics",zp="@firebase/app-check-compat",Qp="@firebase/app-check",$p="@firebase/auth",Wp="@firebase/auth-compat",Yp="@firebase/database",Xp="@firebase/data-connect",Zp="@firebase/database-compat",eg="@firebase/functions",tg="@firebase/functions-compat",ng="@firebase/installations",rg="@firebase/installations-compat",sg="@firebase/messaging",ig="@firebase/messaging-compat",og="@firebase/performance",ag="@firebase/performance-compat",Bg="@firebase/remote-config",ug="@firebase/remote-config-compat",cg="@firebase/storage",lg="@firebase/storage-compat",hg="@firebase/firestore",fg="@firebase/ai",dg="@firebase/firestore-compat",Cg="firebase",pg="12.18.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ci="[DEFAULT]",gg={[ma]:"fire-core",[jp]:"fire-core-compat",[Kp]:"fire-analytics",[Jp]:"fire-analytics-compat",[Qp]:"fire-app-check",[zp]:"fire-app-check-compat",[$p]:"fire-auth",[Wp]:"fire-auth-compat",[Yp]:"fire-rtdb",[Xp]:"fire-data-connect",[Zp]:"fire-rtdb-compat",[eg]:"fire-fn",[tg]:"fire-fn-compat",[ng]:"fire-iid",[rg]:"fire-iid-compat",[sg]:"fire-fcm",[ig]:"fire-fcm-compat",[og]:"fire-perf",[ag]:"fire-perf-compat",[Bg]:"fire-rc",[ug]:"fire-rc-compat",[cg]:"fire-gcs",[lg]:"fire-gcs-compat",[hg]:"fire-fst",[dg]:"fire-fst-compat",[fg]:"fire-vertex","fire-js":"fire-js",[Cg]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Un=new Map,Ea=new Map,_a=new Map;function Dh(r,e){try{r.container.addComponent(e)}catch(t){Tt.debug(`Component ${e.name} failed to register with FirebaseApp ${r.name}`,t)}}function $r(r){let e=r.name;if(_a.has(e))return Tt.debug(`There were multiple attempts to register component ${e}.`),!1;_a.set(e,r);for(let t of Un.values())Dh(t,r);for(let t of Ea.values())Dh(t,r);return!0}function Ia(r,e){let t=r.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),r.container.getProvider(e)}function Th(r,e,t=Ci){Ia(r,e).clearInstance(t)}function Ah(r){return r==null?!1:r.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var mg={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},It=new Qr("app","Firebase",mg);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Da=class{constructor(e,t,n){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=n,this.container.addComponent(new wt("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw It.create("app-deleted",{appName:this._name})}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var bh=pg;function Ta(r,e={}){let t=r;typeof e!="object"&&(e={name:e});let n={name:Ci,automaticDataCollectionEnabled:!0,...e},s=n.name;if(typeof s!="string"||!s)throw It.create("bad-app-name",{appName:String(s)});if(t||(t=aa()),!t)throw It.create("no-options");let i=Un.get(s);if(i)if(Cn(t,i.options)){if(Cn(n,i.config))return i;throw It.create("duplicate-app",{appName:s,mismatchedParam:"config",oldValue:JSON.stringify(i.config),newValue:JSON.stringify(n)})}else throw It.create("duplicate-app",{appName:s,mismatchedParam:"options",oldValue:JSON.stringify(i.options),newValue:JSON.stringify(t)});let a=new fi(s);for(let u of _a.values())a.addComponent(u);let B=new Da(t,n,a);return Un.set(s,B),B}function vh(r=Ci){let e=Un.get(r);if(!e&&r===Ci&&aa())return Ta();if(!e)throw It.create("no-app",{appName:r});return e}async function Sh(r){let e=!1,t=r.name;Un.has(t)?(e=!0,Un.delete(t)):Ea.has(t)&&r.decRefCount()<=0&&(Ea.delete(t),e=!0),e&&(await Promise.all(r.container.getProviders().map(n=>n.delete())),r.isDeleted=!0)}function zt(r,e,t){let n=gg[r]??r;t&&(n+=`-${t}`);let s=n.match(/\s|\//),i=e.match(/\s|\//);if(s||i){let a=[`Unable to register library "${n}" with version "${e}":`];s&&a.push(`library name "${n}" contains illegal characters (whitespace or "/")`),s&&i&&a.push("and"),i&&a.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Tt.warn(a.join(" "));return}$r(new wt(`${n}-version`,()=>({library:n,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Eg="firebase-heartbeat-database",_g=1,Wr="firebase-heartbeat-store",pa=null;function Rh(){return pa||(pa=Eh(Eg,_g,{upgrade:(r,e)=>{switch(e){case 0:try{r.createObjectStore(Wr)}catch(t){console.warn(t)}}}}).catch(r=>{throw It.create("idb-open",{originalErrorMessage:r.message})})),pa}async function Dg(r){try{let t=(await Rh()).transaction(Wr),n=await t.objectStore(Wr).get(Nh(r));return await t.done,n}catch(e){if(e instanceof yt)Tt.warn(e.message);else{let t=It.create("idb-get",{originalErrorMessage:e?.message});Tt.warn(t.message)}}}async function yh(r,e){try{let n=(await Rh()).transaction(Wr,"readwrite");await n.objectStore(Wr).put(e,Nh(r)),await n.done}catch(t){if(t instanceof yt)Tt.warn(t.message);else{let n=It.create("idb-set",{originalErrorMessage:t?.message});Tt.warn(n.message)}}}function Nh(r){return`${r.name}!${r.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var yg=1024,wg=30,ya=class{constructor(e){this.container=e,this._heartbeatsCache=null;let t=this.container.getProvider("app").getImmediate();this._storage=new wa(t),this._heartbeatsCachePromise=this._storage.read().then(n=>(this._heartbeatsCache=n,n))}async triggerHeartbeat(){try{let t=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),n=wh();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===n||this._heartbeatsCache.heartbeats.some(s=>s.date===n))return;if(this._heartbeatsCache.heartbeats.push({date:n,agent:t}),this._heartbeatsCache.heartbeats.length>wg){let s=Tg(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(s,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(e){Tt.warn(e)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return"";let e=wh(),{heartbeatsToSend:t,unsentEntries:n}=Ig(this._heartbeatsCache.heartbeats),s=zr(JSON.stringify({version:2,heartbeats:t}));return this._heartbeatsCache.lastSentHeartbeatDate=e,n.length>0?(this._heartbeatsCache.heartbeats=n,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(e){return Tt.warn(e),""}}};function wh(){return new Date().toISOString().substring(0,10)}function Ig(r,e=yg){let t=[],n=r.slice();for(let s of r){let i=t.find(a=>a.agent===s.agent);if(i){if(i.dates.push(s.date),Ih(t)>e){i.dates.pop();break}}else if(t.push({agent:s.agent,dates:[s.date]}),Ih(t)>e){t.pop();break}n=n.slice(1)}return{heartbeatsToSend:t,unsentEntries:n}}var wa=class{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ba()?lh().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let t=await Dg(this.app);return t?.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){let n=await this.read();return yh(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){let n=await this.read();return yh(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:[...n.heartbeats,...e.heartbeats]})}else return}};function Ih(r){return zr(JSON.stringify({version:2,heartbeats:r})).length}function Tg(r){if(r.length===0)return-1;let e=0,t=r[0].date;for(let n=1;n<r.length;n++)r[n].date<t&&(t=r[n].date,e=n);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ag(r){$r(new wt("platform-logger",e=>new ga(e),"PRIVATE")),$r(new wt("heartbeat",e=>new ya(e),"PRIVATE")),zt(ma,_h,r),zt(ma,_h,"esm2020"),zt("fire-js","")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Ag("");var bg="firebase",vg="12.18.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */zt(bg,vg,"app");var Fh=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},xh={};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var At,Aa;(function(){var r;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(I,m){function _(){}_.prototype=m.prototype,I.F=m.prototype,I.prototype=new _,I.prototype.constructor=I,I.D=function(A,w,S){for(var E=Array(arguments.length-2),Ke=2;Ke<arguments.length;Ke++)E[Ke-2]=arguments[Ke];return m.prototype[w].apply(A,E)}}function t(){this.blockSize=-1}function n(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(n,t),n.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function s(I,m,_){_||(_=0);let A=Array(16);if(typeof m=="string")for(var w=0;w<16;++w)A[w]=m.charCodeAt(_++)|m.charCodeAt(_++)<<8|m.charCodeAt(_++)<<16|m.charCodeAt(_++)<<24;else for(w=0;w<16;++w)A[w]=m[_++]|m[_++]<<8|m[_++]<<16|m[_++]<<24;m=I.g[0],_=I.g[1],w=I.g[2];let S=I.g[3],E;E=m+(S^_&(w^S))+A[0]+3614090360&4294967295,m=_+(E<<7&4294967295|E>>>25),E=S+(w^m&(_^w))+A[1]+3905402710&4294967295,S=m+(E<<12&4294967295|E>>>20),E=w+(_^S&(m^_))+A[2]+606105819&4294967295,w=S+(E<<17&4294967295|E>>>15),E=_+(m^w&(S^m))+A[3]+3250441966&4294967295,_=w+(E<<22&4294967295|E>>>10),E=m+(S^_&(w^S))+A[4]+4118548399&4294967295,m=_+(E<<7&4294967295|E>>>25),E=S+(w^m&(_^w))+A[5]+1200080426&4294967295,S=m+(E<<12&4294967295|E>>>20),E=w+(_^S&(m^_))+A[6]+2821735955&4294967295,w=S+(E<<17&4294967295|E>>>15),E=_+(m^w&(S^m))+A[7]+4249261313&4294967295,_=w+(E<<22&4294967295|E>>>10),E=m+(S^_&(w^S))+A[8]+1770035416&4294967295,m=_+(E<<7&4294967295|E>>>25),E=S+(w^m&(_^w))+A[9]+2336552879&4294967295,S=m+(E<<12&4294967295|E>>>20),E=w+(_^S&(m^_))+A[10]+4294925233&4294967295,w=S+(E<<17&4294967295|E>>>15),E=_+(m^w&(S^m))+A[11]+2304563134&4294967295,_=w+(E<<22&4294967295|E>>>10),E=m+(S^_&(w^S))+A[12]+1804603682&4294967295,m=_+(E<<7&4294967295|E>>>25),E=S+(w^m&(_^w))+A[13]+4254626195&4294967295,S=m+(E<<12&4294967295|E>>>20),E=w+(_^S&(m^_))+A[14]+2792965006&4294967295,w=S+(E<<17&4294967295|E>>>15),E=_+(m^w&(S^m))+A[15]+1236535329&4294967295,_=w+(E<<22&4294967295|E>>>10),E=m+(w^S&(_^w))+A[1]+4129170786&4294967295,m=_+(E<<5&4294967295|E>>>27),E=S+(_^w&(m^_))+A[6]+3225465664&4294967295,S=m+(E<<9&4294967295|E>>>23),E=w+(m^_&(S^m))+A[11]+643717713&4294967295,w=S+(E<<14&4294967295|E>>>18),E=_+(S^m&(w^S))+A[0]+3921069994&4294967295,_=w+(E<<20&4294967295|E>>>12),E=m+(w^S&(_^w))+A[5]+3593408605&4294967295,m=_+(E<<5&4294967295|E>>>27),E=S+(_^w&(m^_))+A[10]+38016083&4294967295,S=m+(E<<9&4294967295|E>>>23),E=w+(m^_&(S^m))+A[15]+3634488961&4294967295,w=S+(E<<14&4294967295|E>>>18),E=_+(S^m&(w^S))+A[4]+3889429448&4294967295,_=w+(E<<20&4294967295|E>>>12),E=m+(w^S&(_^w))+A[9]+568446438&4294967295,m=_+(E<<5&4294967295|E>>>27),E=S+(_^w&(m^_))+A[14]+3275163606&4294967295,S=m+(E<<9&4294967295|E>>>23),E=w+(m^_&(S^m))+A[3]+4107603335&4294967295,w=S+(E<<14&4294967295|E>>>18),E=_+(S^m&(w^S))+A[8]+1163531501&4294967295,_=w+(E<<20&4294967295|E>>>12),E=m+(w^S&(_^w))+A[13]+2850285829&4294967295,m=_+(E<<5&4294967295|E>>>27),E=S+(_^w&(m^_))+A[2]+4243563512&4294967295,S=m+(E<<9&4294967295|E>>>23),E=w+(m^_&(S^m))+A[7]+1735328473&4294967295,w=S+(E<<14&4294967295|E>>>18),E=_+(S^m&(w^S))+A[12]+2368359562&4294967295,_=w+(E<<20&4294967295|E>>>12),E=m+(_^w^S)+A[5]+4294588738&4294967295,m=_+(E<<4&4294967295|E>>>28),E=S+(m^_^w)+A[8]+2272392833&4294967295,S=m+(E<<11&4294967295|E>>>21),E=w+(S^m^_)+A[11]+1839030562&4294967295,w=S+(E<<16&4294967295|E>>>16),E=_+(w^S^m)+A[14]+4259657740&4294967295,_=w+(E<<23&4294967295|E>>>9),E=m+(_^w^S)+A[1]+2763975236&4294967295,m=_+(E<<4&4294967295|E>>>28),E=S+(m^_^w)+A[4]+1272893353&4294967295,S=m+(E<<11&4294967295|E>>>21),E=w+(S^m^_)+A[7]+4139469664&4294967295,w=S+(E<<16&4294967295|E>>>16),E=_+(w^S^m)+A[10]+3200236656&4294967295,_=w+(E<<23&4294967295|E>>>9),E=m+(_^w^S)+A[13]+681279174&4294967295,m=_+(E<<4&4294967295|E>>>28),E=S+(m^_^w)+A[0]+3936430074&4294967295,S=m+(E<<11&4294967295|E>>>21),E=w+(S^m^_)+A[3]+3572445317&4294967295,w=S+(E<<16&4294967295|E>>>16),E=_+(w^S^m)+A[6]+76029189&4294967295,_=w+(E<<23&4294967295|E>>>9),E=m+(_^w^S)+A[9]+3654602809&4294967295,m=_+(E<<4&4294967295|E>>>28),E=S+(m^_^w)+A[12]+3873151461&4294967295,S=m+(E<<11&4294967295|E>>>21),E=w+(S^m^_)+A[15]+530742520&4294967295,w=S+(E<<16&4294967295|E>>>16),E=_+(w^S^m)+A[2]+3299628645&4294967295,_=w+(E<<23&4294967295|E>>>9),E=m+(w^(_|~S))+A[0]+4096336452&4294967295,m=_+(E<<6&4294967295|E>>>26),E=S+(_^(m|~w))+A[7]+1126891415&4294967295,S=m+(E<<10&4294967295|E>>>22),E=w+(m^(S|~_))+A[14]+2878612391&4294967295,w=S+(E<<15&4294967295|E>>>17),E=_+(S^(w|~m))+A[5]+4237533241&4294967295,_=w+(E<<21&4294967295|E>>>11),E=m+(w^(_|~S))+A[12]+1700485571&4294967295,m=_+(E<<6&4294967295|E>>>26),E=S+(_^(m|~w))+A[3]+2399980690&4294967295,S=m+(E<<10&4294967295|E>>>22),E=w+(m^(S|~_))+A[10]+4293915773&4294967295,w=S+(E<<15&4294967295|E>>>17),E=_+(S^(w|~m))+A[1]+2240044497&4294967295,_=w+(E<<21&4294967295|E>>>11),E=m+(w^(_|~S))+A[8]+1873313359&4294967295,m=_+(E<<6&4294967295|E>>>26),E=S+(_^(m|~w))+A[15]+4264355552&4294967295,S=m+(E<<10&4294967295|E>>>22),E=w+(m^(S|~_))+A[6]+2734768916&4294967295,w=S+(E<<15&4294967295|E>>>17),E=_+(S^(w|~m))+A[13]+1309151649&4294967295,_=w+(E<<21&4294967295|E>>>11),E=m+(w^(_|~S))+A[4]+4149444226&4294967295,m=_+(E<<6&4294967295|E>>>26),E=S+(_^(m|~w))+A[11]+3174756917&4294967295,S=m+(E<<10&4294967295|E>>>22),E=w+(m^(S|~_))+A[2]+718787259&4294967295,w=S+(E<<15&4294967295|E>>>17),E=_+(S^(w|~m))+A[9]+3951481745&4294967295,I.g[0]=I.g[0]+m&4294967295,I.g[1]=I.g[1]+(w+(E<<21&4294967295|E>>>11))&4294967295,I.g[2]=I.g[2]+w&4294967295,I.g[3]=I.g[3]+S&4294967295}n.prototype.v=function(I,m){m===void 0&&(m=I.length);let _=m-this.blockSize,A=this.C,w=this.h,S=0;for(;S<m;){if(w==0)for(;S<=_;)s(this,I,S),S+=this.blockSize;if(typeof I=="string"){for(;S<m;)if(A[w++]=I.charCodeAt(S++),w==this.blockSize){s(this,A),w=0;break}}else for(;S<m;)if(A[w++]=I[S++],w==this.blockSize){s(this,A),w=0;break}}this.h=w,this.o+=m},n.prototype.A=function(){var I=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);I[0]=128;for(var m=1;m<I.length-8;++m)I[m]=0;m=this.o*8;for(var _=I.length-8;_<I.length;++_)I[_]=m&255,m/=256;for(this.v(I),I=Array(16),m=0,_=0;_<4;++_)for(let A=0;A<32;A+=8)I[m++]=this.g[_]>>>A&255;return I};function i(I,m){var _=B;return Object.prototype.hasOwnProperty.call(_,I)?_[I]:_[I]=m(I)}function a(I,m){this.h=m;let _=[],A=!0;for(let w=I.length-1;w>=0;w--){let S=I[w]|0;A&&S==m||(_[w]=S,A=!1)}this.g=_}var B={};function u(I){return-128<=I&&I<128?i(I,function(m){return new a([m|0],m<0?-1:0)}):new a([I|0],I<0?-1:0)}function l(I){if(isNaN(I)||!isFinite(I))return C;if(I<0)return H(l(-I));let m=[],_=1;for(let A=0;I>=_;A++)m[A]=I/_|0,_*=4294967296;return new a(m,0)}function f(I,m){if(I.length==0)throw Error("number format error: empty string");if(m=m||10,m<2||36<m)throw Error("radix out of range: "+m);if(I.charAt(0)=="-")return H(f(I.substring(1),m));if(I.indexOf("-")>=0)throw Error('number format error: interior "-" character');let _=l(Math.pow(m,8)),A=C;for(let S=0;S<I.length;S+=8){var w=Math.min(8,I.length-S);let E=parseInt(I.substring(S,S+w),m);w<8?(w=l(Math.pow(m,w)),A=A.j(w).add(l(E))):(A=A.j(_),A=A.add(l(E)))}return A}var C=u(0),D=u(1),v=u(16777216);r=a.prototype,r.m=function(){if(V(this))return-H(this).m();let I=0,m=1;for(let _=0;_<this.g.length;_++){let A=this.i(_);I+=(A>=0?A:4294967296+A)*m,m*=4294967296}return I},r.toString=function(I){if(I=I||10,I<2||36<I)throw Error("radix out of range: "+I);if(R(this))return"0";if(V(this))return"-"+H(this).toString(I);let m=l(Math.pow(I,6));var _=this;let A="";for(;;){let w=ee(_,m).g;_=z(_,w.j(m));let S=((_.g.length>0?_.g[0]:_.h)>>>0).toString(I);if(_=w,R(_))return S+A;for(;S.length<6;)S="0"+S;A=S+A}},r.i=function(I){return I<0?0:I<this.g.length?this.g[I]:this.h};function R(I){if(I.h!=0)return!1;for(let m=0;m<I.g.length;m++)if(I.g[m]!=0)return!1;return!0}function V(I){return I.h==-1}r.l=function(I){return I=z(this,I),V(I)?-1:R(I)?0:1};function H(I){let m=I.g.length,_=[];for(let A=0;A<m;A++)_[A]=~I.g[A];return new a(_,~I.h).add(D)}r.abs=function(){return V(this)?H(this):this},r.add=function(I){let m=Math.max(this.g.length,I.g.length),_=[],A=0;for(let w=0;w<=m;w++){let S=A+(this.i(w)&65535)+(I.i(w)&65535),E=(S>>>16)+(this.i(w)>>>16)+(I.i(w)>>>16);A=E>>>16,S&=65535,E&=65535,_[w]=E<<16|S}return new a(_,_[_.length-1]&-2147483648?-1:0)};function z(I,m){return I.add(H(m))}r.j=function(I){if(R(this)||R(I))return C;if(V(this))return V(I)?H(this).j(H(I)):H(H(this).j(I));if(V(I))return H(this.j(H(I)));if(this.l(v)<0&&I.l(v)<0)return l(this.m()*I.m());let m=this.g.length+I.g.length,_=[];for(var A=0;A<2*m;A++)_[A]=0;for(A=0;A<this.g.length;A++)for(let w=0;w<I.g.length;w++){let S=this.i(A)>>>16,E=this.i(A)&65535,Ke=I.i(w)>>>16,un=I.i(w)&65535;_[2*A+2*w]+=E*un,re(_,2*A+2*w),_[2*A+2*w+1]+=S*un,re(_,2*A+2*w+1),_[2*A+2*w+1]+=E*Ke,re(_,2*A+2*w+1),_[2*A+2*w+2]+=S*Ke,re(_,2*A+2*w+2)}for(I=0;I<m;I++)_[I]=_[2*I+1]<<16|_[2*I];for(I=m;I<2*m;I++)_[I]=0;return new a(_,0)};function re(I,m){for(;(I[m]&65535)!=I[m];)I[m+1]+=I[m]>>>16,I[m]&=65535,m++}function ce(I,m){this.g=I,this.h=m}function ee(I,m){if(R(m))throw Error("division by zero");if(R(I))return new ce(C,C);if(V(I))return m=ee(H(I),m),new ce(H(m.g),H(m.h));if(V(m))return m=ee(I,H(m)),new ce(H(m.g),m.h);if(I.g.length>30){if(V(I)||V(m))throw Error("slowDivide_ only works with positive integers.");for(var _=D,A=m;A.l(I)<=0;)_=pe(_),A=pe(A);var w=me(_,1),S=me(A,1);for(A=me(A,2),_=me(_,2);!R(A);){var E=S.add(A);E.l(I)<=0&&(w=w.add(_),S=E),A=me(A,1),_=me(_,1)}return m=z(I,w.j(m)),new ce(w,m)}for(w=C;I.l(m)>=0;){for(_=Math.max(1,Math.floor(I.m()/m.m())),A=Math.ceil(Math.log(_)/Math.LN2),A=A<=48?1:Math.pow(2,A-48),S=l(_),E=S.j(m);V(E)||E.l(I)>0;)_-=A,S=l(_),E=S.j(m);R(S)&&(S=D),w=w.add(S),I=z(I,E)}return new ce(w,I)}r.B=function(I){return ee(this,I).h},r.and=function(I){let m=Math.max(this.g.length,I.g.length),_=[];for(let A=0;A<m;A++)_[A]=this.i(A)&I.i(A);return new a(_,this.h&I.h)},r.or=function(I){let m=Math.max(this.g.length,I.g.length),_=[];for(let A=0;A<m;A++)_[A]=this.i(A)|I.i(A);return new a(_,this.h|I.h)},r.xor=function(I){let m=Math.max(this.g.length,I.g.length),_=[];for(let A=0;A<m;A++)_[A]=this.i(A)^I.i(A);return new a(_,this.h^I.h)};function pe(I){let m=I.g.length+1,_=[];for(let A=0;A<m;A++)_[A]=I.i(A)<<1|I.i(A-1)>>>31;return new a(_,I.h)}function me(I,m){let _=m>>5;m%=32;let A=I.g.length-_,w=[];for(let S=0;S<A;S++)w[S]=m>0?I.i(S+_)>>>m|I.i(S+_+1)<<32-m:I.i(S+_);return new a(w,I.h)}n.prototype.digest=n.prototype.A,n.prototype.reset=n.prototype.u,n.prototype.update=n.prototype.v,Aa=xh.Md5=n,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.B,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=l,a.fromString=f,At=xh.Integer=a}).apply(typeof Fh<"u"?Fh:typeof self<"u"?self:typeof window<"u"?window:{});var pi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{},bt={};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var ba,Sg,qn,va,Yr,gi,Sa,Ra,Na;(function(){var r,e=Object.defineProperty;function t(o){o=[typeof globalThis=="object"&&globalThis,o,typeof window=="object"&&window,typeof self=="object"&&self,typeof pi=="object"&&pi];for(var c=0;c<o.length;++c){var h=o[c];if(h&&h.Math==Math)return h}throw Error("Cannot find global object")}var n=t(this);function s(o,c){if(c)e:{var h=n;o=o.split(".");for(var d=0;d<o.length-1;d++){var b=o[d];if(!(b in h))break e;h=h[b]}o=o[o.length-1],d=h[o],c=c(d),c!=d&&c!=null&&e(h,o,{configurable:!0,writable:!0,value:c})}}s("Symbol.dispose",function(o){return o||Symbol("Symbol.dispose")}),s("Array.prototype.values",function(o){return o||function(){return this[Symbol.iterator]()}}),s("Object.entries",function(o){return o||function(c){var h=[],d;for(d in c)Object.prototype.hasOwnProperty.call(c,d)&&h.push([d,c[d]]);return h}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var i=i||{},a=this||self;function B(o){var c=typeof o;return c=="object"&&o!=null||c=="function"}function u(o,c,h){return o.call.apply(o.bind,arguments)}function l(o,c,h){return l=u,l.apply(null,arguments)}function f(o,c){var h=Array.prototype.slice.call(arguments,1);return function(){var d=h.slice();return d.push.apply(d,arguments),o.apply(this,d)}}function C(o,c){function h(){}h.prototype=c.prototype,o.Z=c.prototype,o.prototype=new h,o.prototype.constructor=o,o.Ob=function(d,b,N){for(var G=Array(arguments.length-2),te=2;te<arguments.length;te++)G[te-2]=arguments[te];return c.prototype[b].apply(d,G)}}var D=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?o=>o&&AsyncContext.Snapshot.wrap(o):o=>o;function v(o){let c=o.length;if(c>0){let h=Array(c);for(let d=0;d<c;d++)h[d]=o[d];return h}return[]}function R(o,c){for(let d=1;d<arguments.length;d++){let b=arguments[d];var h=typeof b;if(h=h!="object"?h:b?Array.isArray(b)?"array":h:"null",h=="array"||h=="object"&&typeof b.length=="number"){h=o.length||0;let N=b.length||0;o.length=h+N;for(let G=0;G<N;G++)o[h+G]=b[G]}else o.push(b)}}class V{constructor(c,h){this.i=c,this.j=h,this.h=0,this.g=null}get(){let c;return this.h>0?(this.h--,c=this.g,this.g=c.next,c.next=null):c=this.i(),c}}function H(o){a.setTimeout(()=>{throw o},0)}function z(){var o=I;let c=null;return o.g&&(c=o.g,o.g=o.g.next,o.g||(o.h=null),c.next=null),c}class re{constructor(){this.h=this.g=null}add(c,h){let d=ce.get();d.set(c,h),this.h?this.h.next=d:this.g=d,this.h=d}}var ce=new V(()=>new ee,o=>o.reset());class ee{constructor(){this.next=this.g=this.h=null}set(c,h){this.h=c,this.g=h,this.next=null}reset(){this.next=this.g=this.h=null}}let pe,me=!1,I=new re,m=()=>{let o=Promise.resolve(void 0);pe=()=>{o.then(_)}};function _(){for(var o;o=z();){try{o.h.call(o.g)}catch(h){H(h)}var c=ce;c.j(o),c.h<100&&(c.h++,o.next=c.g,c.g=o)}me=!1}function A(){this.u=this.u,this.C=this.C}A.prototype.u=!1,A.prototype.dispose=function(){this.u||(this.u=!0,this.N())},A.prototype[Symbol.dispose]=function(){this.dispose()},A.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function w(o,c){this.type=o,this.g=this.target=c,this.defaultPrevented=!1}w.prototype.h=function(){this.defaultPrevented=!0};var S=(function(){if(!a.addEventListener||!Object.defineProperty)return!1;var o=!1,c=Object.defineProperty({},"passive",{get:function(){o=!0}});try{let h=()=>{};a.addEventListener("test",h,c),a.removeEventListener("test",h,c)}catch{}return o})();function E(o){return/^[\s\xa0]*$/.test(o)}function Ke(o,c){w.call(this,o?o.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,o&&this.init(o,c)}C(Ke,w),Ke.prototype.init=function(o,c){let h=this.type=o.type,d=o.changedTouches&&o.changedTouches.length?o.changedTouches[0]:null;this.target=o.target||o.srcElement,this.g=c,c=o.relatedTarget,c||(h=="mouseover"?c=o.fromElement:h=="mouseout"&&(c=o.toElement)),this.relatedTarget=c,d?(this.clientX=d.clientX!==void 0?d.clientX:d.pageX,this.clientY=d.clientY!==void 0?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0):(this.clientX=o.clientX!==void 0?o.clientX:o.pageX,this.clientY=o.clientY!==void 0?o.clientY:o.pageY,this.screenX=o.screenX||0,this.screenY=o.screenY||0),this.button=o.button,this.key=o.key||"",this.ctrlKey=o.ctrlKey,this.altKey=o.altKey,this.shiftKey=o.shiftKey,this.metaKey=o.metaKey,this.pointerId=o.pointerId||0,this.pointerType=o.pointerType,this.state=o.state,this.i=o,o.defaultPrevented&&Ke.Z.h.call(this)},Ke.prototype.h=function(){Ke.Z.h.call(this);let o=this.i;o.preventDefault?o.preventDefault():o.returnValue=!1};var un="closure_listenable_"+(Math.random()*1e6|0),GC=0;function HC(o,c,h,d,b){this.listener=o,this.proxy=null,this.src=c,this.type=h,this.capture=!!d,this.ha=b,this.key=++GC,this.da=this.fa=!1}function Ws(o){o.da=!0,o.listener=null,o.proxy=null,o.src=null,o.ha=null}function Ys(o,c,h){for(let d in o)c.call(h,o[d],d,o)}function UC(o,c){for(let h in o)c.call(void 0,o[h],h,o)}function el(o){let c={};for(let h in o)c[h]=o[h];return c}let tl="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function nl(o,c){let h,d;for(let b=1;b<arguments.length;b++){d=arguments[b];for(h in d)o[h]=d[h];for(let N=0;N<tl.length;N++)h=tl[N],Object.prototype.hasOwnProperty.call(d,h)&&(o[h]=d[h])}}function Xs(o){this.src=o,this.g={},this.h=0}Xs.prototype.add=function(o,c,h,d,b){let N=o.toString();o=this.g[N],o||(o=this.g[N]=[],this.h++);let G=Vo(o,c,d,b);return G>-1?(c=o[G],h||(c.fa=!1)):(c=new HC(c,this.src,N,!!d,b),c.fa=h,o.push(c)),c};function Lo(o,c){let h=c.type;if(h in o.g){var d=o.g[h],b=Array.prototype.indexOf.call(d,c,void 0),N;(N=b>=0)&&Array.prototype.splice.call(d,b,1),N&&(Ws(c),o.g[h].length==0&&(delete o.g[h],o.h--))}}function Vo(o,c,h,d){for(let b=0;b<o.length;++b){let N=o[b];if(!N.da&&N.listener==c&&N.capture==!!h&&N.ha==d)return b}return-1}var ko="closure_lm_"+(Math.random()*1e6|0),Mo={};function rl(o,c,h,d,b){if(Array.isArray(c)){for(let N=0;N<c.length;N++)rl(o,c[N],h,d,b);return null}return h=ol(h),o&&o[un]?o.J(c,h,B(d)?!!d.capture:!1,b):qC(o,c,h,!1,d,b)}function qC(o,c,h,d,b,N){if(!c)throw Error("Invalid event type");let G=B(b)?!!b.capture:!!b,te=Ho(o);if(te||(o[ko]=te=new Xs(o)),h=te.add(c,h,d,G,N),h.proxy)return h;if(d=jC(),h.proxy=d,d.src=o,d.listener=h,o.addEventListener)S||(b=G),b===void 0&&(b=!1),o.addEventListener(c.toString(),d,b);else if(o.attachEvent)o.attachEvent(il(c.toString()),d);else if(o.addListener&&o.removeListener)o.addListener(d);else throw Error("addEventListener and attachEvent are unavailable.");return h}function jC(){function o(h){return c.call(o.src,o.listener,h)}let c=JC;return o}function sl(o,c,h,d,b){if(Array.isArray(c))for(var N=0;N<c.length;N++)sl(o,c[N],h,d,b);else d=B(d)?!!d.capture:!!d,h=ol(h),o&&o[un]?(o=o.i,N=String(c).toString(),N in o.g&&(c=o.g[N],h=Vo(c,h,d,b),h>-1&&(Ws(c[h]),Array.prototype.splice.call(c,h,1),c.length==0&&(delete o.g[N],o.h--)))):o&&(o=Ho(o))&&(c=o.g[c.toString()],o=-1,c&&(o=Vo(c,h,d,b)),(h=o>-1?c[o]:null)&&Go(h))}function Go(o){if(typeof o!="number"&&o&&!o.da){var c=o.src;if(c&&c[un])Lo(c.i,o);else{var h=o.type,d=o.proxy;c.removeEventListener?c.removeEventListener(h,d,o.capture):c.detachEvent?c.detachEvent(il(h),d):c.addListener&&c.removeListener&&c.removeListener(d),(h=Ho(c))?(Lo(h,o),h.h==0&&(h.src=null,c[ko]=null)):Ws(o)}}}function il(o){return o in Mo?Mo[o]:Mo[o]="on"+o}function JC(o,c){if(o.da)o=!0;else{c=new Ke(c,this);let h=o.listener,d=o.ha||o.src;o.fa&&Go(o),o=h.call(d,c)}return o}function Ho(o){return o=o[ko],o instanceof Xs?o:null}var Uo="__closure_events_fn_"+(Math.random()*1e9>>>0);function ol(o){return typeof o=="function"?o:(o[Uo]||(o[Uo]=function(c){return o.handleEvent(c)}),o[Uo])}function Ve(){A.call(this),this.i=new Xs(this),this.M=this,this.G=null}C(Ve,A),Ve.prototype[un]=!0,Ve.prototype.removeEventListener=function(o,c,h,d){sl(this,o,c,h,d)};function Ue(o,c){var h,d=o.G;if(d)for(h=[];d;d=d.G)h.push(d);if(o=o.M,d=c.type||c,typeof c=="string")c=new w(c,o);else if(c instanceof w)c.target=c.target||o;else{var b=c;c=new w(d,o),nl(c,b)}b=!0;let N,G;if(h)for(G=h.length-1;G>=0;G--)N=c.g=h[G],b=Zs(N,d,!0,c)&&b;if(N=c.g=o,b=Zs(N,d,!0,c)&&b,b=Zs(N,d,!1,c)&&b,h)for(G=0;G<h.length;G++)N=c.g=h[G],b=Zs(N,d,!1,c)&&b}Ve.prototype.N=function(){if(Ve.Z.N.call(this),this.i){var o=this.i;for(let c in o.g){let h=o.g[c];for(let d=0;d<h.length;d++)Ws(h[d]);delete o.g[c],o.h--}}this.G=null},Ve.prototype.J=function(o,c,h,d){return this.i.add(String(o),c,!1,h,d)},Ve.prototype.K=function(o,c,h,d){return this.i.add(String(o),c,!0,h,d)};function Zs(o,c,h,d){if(c=o.i.g[String(c)],!c)return!0;c=c.concat();let b=!0;for(let N=0;N<c.length;++N){let G=c[N];if(G&&!G.da&&G.capture==h){let te=G.listener,ve=G.ha||G.src;G.fa&&Lo(o.i,G),b=te.call(ve,d)!==!1&&b}}return b&&!d.defaultPrevented}function KC(o,c){if(typeof o!="function")if(o&&typeof o.handleEvent=="function")o=l(o.handleEvent,o);else throw Error("Invalid listener argument");return Number(c)>2147483647?-1:a.setTimeout(o,c||0)}function al(o){o.g=KC(()=>{o.g=null,o.i&&(o.i=!1,al(o))},o.l);let c=o.h;o.h=null,o.m.apply(null,c)}class zC extends A{constructor(c,h){super(),this.m=c,this.l=h,this.h=null,this.i=!1,this.g=null}j(c){this.h=arguments,this.g?this.i=!0:al(this)}N(){super.N(),this.g&&(a.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Nr(o){A.call(this),this.h=o,this.g={}}C(Nr,A);var Bl=[];function ul(o){Ys(o.g,function(c,h){this.g.hasOwnProperty(h)&&Go(c)},o),o.g={}}Nr.prototype.N=function(){Nr.Z.N.call(this),ul(this)},Nr.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var qo=a.JSON.stringify,QC=a.JSON.parse,$C=class{stringify(o){return a.JSON.stringify(o,void 0)}parse(o){return a.JSON.parse(o,void 0)}};function cl(){}function ll(){}var Fr={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function jo(){w.call(this,"d")}C(jo,w);function Jo(){w.call(this,"c")}C(Jo,w);var cn={},hl=null;function ei(){return hl=hl||new Ve}cn.Ia="serverreachability";function fl(o){w.call(this,cn.Ia,o)}C(fl,w);function xr(o){let c=ei();Ue(c,new fl(c))}cn.STAT_EVENT="statevent";function dl(o,c){w.call(this,cn.STAT_EVENT,o),this.stat=c}C(dl,w);function qe(o){let c=ei();Ue(c,new dl(c,o))}cn.Ja="timingevent";function Cl(o,c){w.call(this,cn.Ja,o),this.size=c}C(Cl,w);function Pr(o,c){if(typeof o!="function")throw Error("Fn must not be null and must be a function");return a.setTimeout(function(){o()},c)}function Or(){this.g=!0}Or.prototype.ua=function(){this.g=!1};function WC(o,c,h,d,b,N){o.info(function(){if(o.g)if(N){var G="",te=N.split("&");for(let he=0;he<te.length;he++){var ve=te[he].split("=");if(ve.length>1){let Ne=ve[0];ve=ve[1];let pt=Ne.split("_");G=pt.length>=2&&pt[1]=="type"?G+(Ne+"="+ve+"&"):G+(Ne+"=redacted&")}}}else G=null;else G=N;return"XMLHTTP REQ ("+d+") [attempt "+b+"]: "+c+`
`+h+`
`+G})}function YC(o,c,h,d,b,N,G){o.info(function(){return"XMLHTTP RESP ("+d+") [ attempt "+b+"]: "+c+`
`+h+`
`+N+" "+G})}function kn(o,c,h,d){o.info(function(){return"XMLHTTP TEXT ("+c+"): "+ZC(o,h)+(d?" "+d:"")})}function XC(o,c){o.info(function(){return"TIMEOUT: "+c})}Or.prototype.info=function(){};function ZC(o,c){if(!o.g)return c;if(!c)return null;try{let N=JSON.parse(c);if(N){for(o=0;o<N.length;o++)if(Array.isArray(N[o])){var h=N[o];if(!(h.length<2)){var d=h[1];if(Array.isArray(d)&&!(d.length<1)){var b=d[0];if(b!="noop"&&b!="stop"&&b!="close")for(let G=1;G<d.length;G++)d[G]=""}}}}return qo(N)}catch{return c}}var ti={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},pl={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},gl;function Ko(){}C(Ko,cl),Ko.prototype.g=function(){return new XMLHttpRequest},gl=new Ko;function Lr(o){return encodeURIComponent(String(o))}function ep(o){var c=1;o=o.split(":");let h=[];for(;c>0&&o.length;)h.push(o.shift()),c--;return o.length&&h.push(o.join(":")),h}function Gt(o,c,h,d){this.j=o,this.i=c,this.l=h,this.S=d||1,this.V=new Nr(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new ml}function ml(){this.i=null,this.g="",this.h=!1}var El={},zo={};function Qo(o,c,h){o.M=1,o.A=ri(Ct(c)),o.u=h,o.R=!0,_l(o,null)}function _l(o,c){o.F=Date.now(),ni(o),o.B=Ct(o.A);var h=o.B,d=o.S;Array.isArray(d)||(d=[String(d)]),xl(h.i,"t",d),o.C=0,h=o.j.L,o.h=new ml,o.g=Yl(o.j,h?c:null,!o.u),o.P>0&&(o.O=new zC(l(o.Y,o,o.g),o.P)),c=o.V,h=o.g,d=o.ba;var b="readystatechange";Array.isArray(b)||(b&&(Bl[0]=b.toString()),b=Bl);for(let N=0;N<b.length;N++){let G=rl(h,b[N],d||c.handleEvent,!1,c.h||c);if(!G)break;c.g[G.key]=G}c=o.J?el(o.J):{},o.u?(o.v||(o.v="POST"),c["Content-Type"]="application/x-www-form-urlencoded",o.g.ea(o.B,o.v,o.u,c)):(o.v="GET",o.g.ea(o.B,o.v,null,c)),xr(),WC(o.i,o.v,o.B,o.l,o.S,o.u)}Gt.prototype.ba=function(o){o=o.target;let c=this.O;c&&qt(o)==3?c.j():this.Y(o)},Gt.prototype.Y=function(o){try{if(o==this.g)e:{let te=qt(this.g),ve=this.g.ya(),he=this.g.ca();if(!(te<3)&&(te!=3||this.g&&(this.h.h||this.g.la()||Gl(this.g)))){this.K||te!=4||ve==7||(ve==8||he<=0?xr(3):xr(2)),$o(this);var c=this.g.ca();this.X=c;var h=tp(this);if(this.o=c==200,YC(this.i,this.v,this.B,this.l,this.S,te,c),this.o){if(this.U&&!this.L){t:{if(this.g){var d,b=this.g;if((d=b.g?b.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!E(d)){var N=d;break t}}N=null}if(o=N)kn(this.i,this.l,o,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Wo(this,o);else{this.o=!1,this.m=3,qe(12),ln(this),Vr(this);break e}}if(this.R){o=!0;let Ne;for(;!this.K&&this.C<h.length;)if(Ne=np(this,h),Ne==zo){te==4&&(this.m=4,qe(14),o=!1),kn(this.i,this.l,null,"[Incomplete Response]");break}else if(Ne==El){this.m=4,qe(15),kn(this.i,this.l,h,"[Invalid Chunk]"),o=!1;break}else kn(this.i,this.l,Ne,null),Wo(this,Ne);if(Dl(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),te!=4||h.length!=0||this.h.h||(this.m=1,qe(16),o=!1),this.o=this.o&&o,!o)kn(this.i,this.l,h,"[Invalid Chunked Response]"),ln(this),Vr(this);else if(h.length>0&&!this.W){this.W=!0;var G=this.j;G.g==this&&G.aa&&!G.P&&(G.j.info("Great, no buffering proxy detected. Bytes received: "+h.length),ra(G),G.P=!0,qe(11))}}else kn(this.i,this.l,h,null),Wo(this,h);te==4&&ln(this),this.o&&!this.K&&(te==4?zl(this.j,this):(this.o=!1,ni(this)))}else pp(this.g),c==400&&h.indexOf("Unknown SID")>0?(this.m=3,qe(12)):(this.m=0,qe(13)),ln(this),Vr(this)}}}catch{}finally{}};function tp(o){if(!Dl(o))return o.g.la();let c=Gl(o.g);if(c==="")return"";let h="",d=c.length,b=qt(o.g)==4;if(!o.h.i){if(typeof TextDecoder>"u")return ln(o),Vr(o),"";o.h.i=new a.TextDecoder}for(let N=0;N<d;N++)o.h.h=!0,h+=o.h.i.decode(c[N],{stream:!(b&&N==d-1)});return c.length=0,o.h.g+=h,o.C=0,o.h.g}function Dl(o){return o.g?o.v=="GET"&&o.M!=2&&o.j.Aa:!1}function np(o,c){var h=o.C,d=c.indexOf(`
`,h);return d==-1?zo:(h=Number(c.substring(h,d)),isNaN(h)?El:(d+=1,d+h>c.length?zo:(c=c.slice(d,d+h),o.C=d+h,c)))}Gt.prototype.cancel=function(){this.K=!0,ln(this)};function ni(o){o.T=Date.now()+o.H,yl(o,o.H)}function yl(o,c){if(o.D!=null)throw Error("WatchDog timer not null");o.D=Pr(l(o.aa,o),c)}function $o(o){o.D&&(a.clearTimeout(o.D),o.D=null)}Gt.prototype.aa=function(){this.D=null;let o=Date.now();o-this.T>=0?(XC(this.i,this.B),this.M!=2&&(xr(),qe(17)),ln(this),this.m=2,Vr(this)):yl(this,this.T-o)};function Vr(o){o.j.I==0||o.K||zl(o.j,o)}function ln(o){$o(o);var c=o.O;c&&typeof c.dispose=="function"&&c.dispose(),o.O=null,ul(o.V),o.g&&(c=o.g,o.g=null,c.abort(),c.dispose())}function Wo(o,c){try{var h=o.j;if(h.I!=0&&(h.g==o||Yo(h.h,o))){if(!o.L&&Yo(h.h,o)&&h.I==3){try{var d=h.Ba.g.parse(c)}catch{d=null}if(Array.isArray(d)&&d.length==3){var b=d;if(b[0]==0){e:if(!h.v){if(h.g)if(h.g.F+3e3<o.F)ui(h),ai(h);else break e;na(h),qe(18)}}else h.xa=b[1],0<h.xa-h.K&&b[2]<37500&&h.F&&h.A==0&&!h.C&&(h.C=Pr(l(h.Va,h),6e3));Tl(h.h)<=1&&h.ta&&(h.ta=void 0)}else fn(h,11)}else if((o.L||h.g==o)&&ui(h),!E(c))for(b=h.Ba.g.parse(c),c=0;c<b.length;c++){let he=b[c],Ne=he[0];if(!(Ne<=h.K))if(h.K=Ne,he=he[1],h.I==2)if(he[0]=="c"){h.M=he[1],h.ba=he[2];let pt=he[3];pt!=null&&(h.ka=pt,h.j.info("VER="+h.ka));let dn=he[4];dn!=null&&(h.za=dn,h.j.info("SVER="+h.za));let jt=he[5];jt!=null&&typeof jt=="number"&&jt>0&&(d=1.5*jt,h.O=d,h.j.info("backChannelRequestTimeoutMs_="+d)),d=h;let Jt=o.g;if(Jt){let li=Jt.g?Jt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(li){var N=d.h;N.g||li.indexOf("spdy")==-1&&li.indexOf("quic")==-1&&li.indexOf("h2")==-1||(N.j=N.l,N.g=new Set,N.h&&(Xo(N,N.h),N.h=null))}if(d.G){let sa=Jt.g?Jt.g.getResponseHeader("X-HTTP-Session-Id"):null;sa&&(d.wa=sa,ge(d.J,d.G,sa))}}h.I=3,h.l&&h.l.ra(),h.aa&&(h.T=Date.now()-o.F,h.j.info("Handshake RTT: "+h.T+"ms")),d=h;var G=o;if(d.na=Wl(d,d.L?d.ba:null,d.W),G.L){Al(d.h,G);var te=G,ve=d.O;ve&&(te.H=ve),te.D&&($o(te),ni(te)),d.g=G}else Jl(d);h.i.length>0&&Bi(h)}else he[0]!="stop"&&he[0]!="close"||fn(h,7);else h.I==3&&(he[0]=="stop"||he[0]=="close"?he[0]=="stop"?fn(h,7):ta(h):he[0]!="noop"&&h.l&&h.l.qa(he),h.A=0)}}xr(4)}catch{}}var rp=class{constructor(o,c){this.g=o,this.map=c}};function wl(o){this.l=o||10,a.PerformanceNavigationTiming?(o=a.performance.getEntriesByType("navigation"),o=o.length>0&&(o[0].nextHopProtocol=="hq"||o[0].nextHopProtocol=="h2")):o=!!(a.chrome&&a.chrome.loadTimes&&a.chrome.loadTimes()&&a.chrome.loadTimes().wasFetchedViaSpdy),this.j=o?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function Il(o){return o.h?!0:o.g?o.g.size>=o.j:!1}function Tl(o){return o.h?1:o.g?o.g.size:0}function Yo(o,c){return o.h?o.h==c:o.g?o.g.has(c):!1}function Xo(o,c){o.g?o.g.add(c):o.h=c}function Al(o,c){o.h&&o.h==c?o.h=null:o.g&&o.g.has(c)&&o.g.delete(c)}wl.prototype.cancel=function(){if(this.i=bl(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(let o of this.g.values())o.cancel();this.g.clear()}};function bl(o){if(o.h!=null)return o.i.concat(o.h.G);if(o.g!=null&&o.g.size!==0){let c=o.i;for(let h of o.g.values())c=c.concat(h.G);return c}return v(o.i)}var vl=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function sp(o,c){if(o){o=o.split("&");for(let h=0;h<o.length;h++){let d=o[h].indexOf("="),b,N=null;d>=0?(b=o[h].substring(0,d),N=o[h].substring(d+1)):b=o[h],c(b,N?decodeURIComponent(N.replace(/\+/g," ")):"")}}}function Ht(o){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let c;o instanceof Ht?(this.l=o.l,kr(this,o.j),this.o=o.o,this.g=o.g,Mr(this,o.u),this.h=o.h,Zo(this,Pl(o.i)),this.m=o.m):o&&(c=String(o).match(vl))?(this.l=!1,kr(this,c[1]||"",!0),this.o=Gr(c[2]||""),this.g=Gr(c[3]||"",!0),Mr(this,c[4]),this.h=Gr(c[5]||"",!0),Zo(this,c[6]||"",!0),this.m=Gr(c[7]||"")):(this.l=!1,this.i=new Ur(null,this.l))}Ht.prototype.toString=function(){let o=[];var c=this.j;c&&o.push(Hr(c,Sl,!0),":");var h=this.g;return(h||c=="file")&&(o.push("//"),(c=this.o)&&o.push(Hr(c,Sl,!0),"@"),o.push(Lr(h).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),h=this.u,h!=null&&o.push(":",String(h))),(h=this.h)&&(this.g&&h.charAt(0)!="/"&&o.push("/"),o.push(Hr(h,h.charAt(0)=="/"?ap:op,!0))),(h=this.i.toString())&&o.push("?",h),(h=this.m)&&o.push("#",Hr(h,up)),o.join("")},Ht.prototype.resolve=function(o){let c=Ct(this),h=!!o.j;h?kr(c,o.j):h=!!o.o,h?c.o=o.o:h=!!o.g,h?c.g=o.g:h=o.u!=null;var d=o.h;if(h)Mr(c,o.u);else if(h=!!o.h){if(d.charAt(0)!="/")if(this.g&&!this.h)d="/"+d;else{var b=c.h.lastIndexOf("/");b!=-1&&(d=c.h.slice(0,b+1)+d)}if(b=d,b==".."||b==".")d="";else if(b.indexOf("./")!=-1||b.indexOf("/.")!=-1){d=b.lastIndexOf("/",0)==0,b=b.split("/");let N=[];for(let G=0;G<b.length;){let te=b[G++];te=="."?d&&G==b.length&&N.push(""):te==".."?((N.length>1||N.length==1&&N[0]!="")&&N.pop(),d&&G==b.length&&N.push("")):(N.push(te),d=!0)}d=N.join("/")}else d=b}return h?c.h=d:h=o.i.toString()!=="",h?Zo(c,Pl(o.i)):h=!!o.m,h&&(c.m=o.m),c};function Ct(o){return new Ht(o)}function kr(o,c,h){o.j=h?Gr(c,!0):c,o.j&&(o.j=o.j.replace(/:$/,""))}function Mr(o,c){if(c){if(c=Number(c),isNaN(c)||c<0)throw Error("Bad port number "+c);o.u=c}else o.u=null}function Zo(o,c,h){c instanceof Ur?(o.i=c,cp(o.i,o.l)):(h||(c=Hr(c,Bp)),o.i=new Ur(c,o.l))}function ge(o,c,h){o.i.set(c,h)}function ri(o){return ge(o,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),o}function Gr(o,c){return o?c?decodeURI(o.replace(/%25/g,"%2525")):decodeURIComponent(o):""}function Hr(o,c,h){return typeof o=="string"?(o=encodeURI(o).replace(c,ip),h&&(o=o.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),o):null}function ip(o){return o=o.charCodeAt(0),"%"+(o>>4&15).toString(16)+(o&15).toString(16)}var Sl=/[#\/\?@]/g,op=/[#\?:]/g,ap=/[#\?]/g,Bp=/[#\?@]/g,up=/#/g;function Ur(o,c){this.h=this.g=null,this.i=o||null,this.j=!!c}function hn(o){o.g||(o.g=new Map,o.h=0,o.i&&sp(o.i,function(c,h){o.add(decodeURIComponent(c.replace(/\+/g," ")),h)}))}r=Ur.prototype,r.add=function(o,c){hn(this),this.i=null,o=Mn(this,o);let h=this.g.get(o);return h||this.g.set(o,h=[]),h.push(c),this.h+=1,this};function Rl(o,c){hn(o),c=Mn(o,c),o.g.has(c)&&(o.i=null,o.h-=o.g.get(c).length,o.g.delete(c))}function Nl(o,c){return hn(o),c=Mn(o,c),o.g.has(c)}r.forEach=function(o,c){hn(this),this.g.forEach(function(h,d){h.forEach(function(b){o.call(c,b,d,this)},this)},this)};function Fl(o,c){hn(o);let h=[];if(typeof c=="string")Nl(o,c)&&(h=h.concat(o.g.get(Mn(o,c))));else for(o=Array.from(o.g.values()),c=0;c<o.length;c++)h=h.concat(o[c]);return h}r.set=function(o,c){return hn(this),this.i=null,o=Mn(this,o),Nl(this,o)&&(this.h-=this.g.get(o).length),this.g.set(o,[c]),this.h+=1,this},r.get=function(o,c){return o?(o=Fl(this,o),o.length>0?String(o[0]):c):c};function xl(o,c,h){Rl(o,c),h.length>0&&(o.i=null,o.g.set(Mn(o,c),v(h)),o.h+=h.length)}r.toString=function(){if(this.i)return this.i;if(!this.g)return"";let o=[],c=Array.from(this.g.keys());for(let d=0;d<c.length;d++){var h=c[d];let b=Lr(h);h=Fl(this,h);for(let N=0;N<h.length;N++){let G=b;h[N]!==""&&(G+="="+Lr(h[N])),o.push(G)}}return this.i=o.join("&")};function Pl(o){let c=new Ur;return c.i=o.i,o.g&&(c.g=new Map(o.g),c.h=o.h),c}function Mn(o,c){return c=String(c),o.j&&(c=c.toLowerCase()),c}function cp(o,c){c&&!o.j&&(hn(o),o.i=null,o.g.forEach(function(h,d){let b=d.toLowerCase();d!=b&&(Rl(this,d),xl(this,b,h))},o)),o.j=c}function lp(o,c){let h=new Or;if(a.Image){let d=new Image;d.onload=f(Ut,h,"TestLoadImage: loaded",!0,c,d),d.onerror=f(Ut,h,"TestLoadImage: error",!1,c,d),d.onabort=f(Ut,h,"TestLoadImage: abort",!1,c,d),d.ontimeout=f(Ut,h,"TestLoadImage: timeout",!1,c,d),a.setTimeout(function(){d.ontimeout&&d.ontimeout()},1e4),d.src=o}else c(!1)}function hp(o,c){let h=new Or,d=new AbortController,b=setTimeout(()=>{d.abort(),Ut(h,"TestPingServer: timeout",!1,c)},1e4);fetch(o,{signal:d.signal}).then(N=>{clearTimeout(b),N.ok?Ut(h,"TestPingServer: ok",!0,c):Ut(h,"TestPingServer: server error",!1,c)}).catch(()=>{clearTimeout(b),Ut(h,"TestPingServer: error",!1,c)})}function Ut(o,c,h,d,b){try{b&&(b.onload=null,b.onerror=null,b.onabort=null,b.ontimeout=null),d(h)}catch{}}function fp(){this.g=new $C}function si(o){this.i=o.Sb||null,this.h=o.ab||!1}C(si,cl),si.prototype.g=function(){return new ii(this.i,this.h)};function ii(o,c){Ve.call(this),this.H=o,this.o=c,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}C(ii,Ve),r=ii.prototype,r.open=function(o,c){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=o,this.D=c,this.readyState=1,jr(this)},r.send=function(o){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;let c={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};o&&(c.body=o),(this.H||a).fetch(new Request(this.D,c)).then(this.Pa.bind(this),this.ga.bind(this))},r.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,qr(this)),this.readyState=0},r.Pa=function(o){if(this.g&&(this.l=o,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=o.headers,this.readyState=2,jr(this)),this.g&&(this.readyState=3,jr(this),this.g)))if(this.responseType==="arraybuffer")o.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof a.ReadableStream<"u"&&"body"in o){if(this.j=o.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Ol(this)}else o.text().then(this.Oa.bind(this),this.ga.bind(this))};function Ol(o){o.j.read().then(o.Ma.bind(o)).catch(o.ga.bind(o))}r.Ma=function(o){if(this.g){if(this.o&&o.value)this.response.push(o.value);else if(!this.o){var c=o.value?o.value:new Uint8Array(0);(c=this.B.decode(c,{stream:!o.done}))&&(this.response=this.responseText+=c)}o.done?qr(this):jr(this),this.readyState==3&&Ol(this)}},r.Oa=function(o){this.g&&(this.response=this.responseText=o,qr(this))},r.Na=function(o){this.g&&(this.response=o,qr(this))},r.ga=function(){this.g&&qr(this)};function qr(o){o.readyState=4,o.l=null,o.j=null,o.B=null,jr(o)}r.setRequestHeader=function(o,c){this.A.append(o,c)},r.getResponseHeader=function(o){return this.h&&this.h.get(o.toLowerCase())||""},r.getAllResponseHeaders=function(){if(!this.h)return"";let o=[],c=this.h.entries();for(var h=c.next();!h.done;)h=h.value,o.push(h[0]+": "+h[1]),h=c.next();return o.join(`\r
`)};function jr(o){o.onreadystatechange&&o.onreadystatechange.call(o)}Object.defineProperty(ii.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(o){this.m=o?"include":"same-origin"}});function Ll(o){let c="";return Ys(o,function(h,d){c+=d,c+=":",c+=h,c+=`\r
`}),c}function ea(o,c,h){e:{for(d in h){var d=!1;break e}d=!0}d||(h=Ll(h),typeof o=="string"?h!=null&&Lr(h):ge(o,c,h))}function Ee(o){Ve.call(this),this.headers=new Map,this.L=o||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}C(Ee,Ve);var dp=/^https?$/i,Cp=["POST","PUT"];r=Ee.prototype,r.Fa=function(o){this.H=o},r.ea=function(o,c,h,d){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+o);c=c?c.toUpperCase():"GET",this.D=o,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():gl.g(),this.g.onreadystatechange=D(l(this.Ca,this));try{this.B=!0,this.g.open(c,String(o),!0),this.B=!1}catch(N){Vl(this,N);return}if(o=h||"",h=new Map(this.headers),d)if(Object.getPrototypeOf(d)===Object.prototype)for(var b in d)h.set(b,d[b]);else if(typeof d.keys=="function"&&typeof d.get=="function")for(let N of d.keys())h.set(N,d.get(N));else throw Error("Unknown input type for opt_headers: "+String(d));d=Array.from(h.keys()).find(N=>N.toLowerCase()=="content-type"),b=a.FormData&&o instanceof a.FormData,!(Array.prototype.indexOf.call(Cp,c,void 0)>=0)||d||b||h.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(let[N,G]of h)this.g.setRequestHeader(N,G);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(o),this.v=!1}catch(N){Vl(this,N)}};function Vl(o,c){o.h=!1,o.g&&(o.j=!0,o.g.abort(),o.j=!1),o.l=c,o.o=5,kl(o),oi(o)}function kl(o){o.A||(o.A=!0,Ue(o,"complete"),Ue(o,"error"))}r.abort=function(o){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=o||7,Ue(this,"complete"),Ue(this,"abort"),oi(this))},r.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),oi(this,!0)),Ee.Z.N.call(this)},r.Ca=function(){this.u||(this.B||this.v||this.j?Ml(this):this.Xa())},r.Xa=function(){Ml(this)};function Ml(o){if(o.h&&typeof i<"u"){if(o.v&&qt(o)==4)setTimeout(o.Ca.bind(o),0);else if(Ue(o,"readystatechange"),qt(o)==4){o.h=!1;try{let N=o.ca();e:switch(N){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break e;default:c=!1}var h;if(!(h=c)){var d;if(d=N===0){let G=String(o.D).match(vl)[1]||null;!G&&a.self&&a.self.location&&(G=a.self.location.protocol.slice(0,-1)),d=!dp.test(G?G.toLowerCase():"")}h=d}if(h)Ue(o,"complete"),Ue(o,"success");else{o.o=6;try{var b=qt(o)>2?o.g.statusText:""}catch{b=""}o.l=b+" ["+o.ca()+"]",kl(o)}}finally{oi(o)}}}}function oi(o,c){if(o.g){o.m&&(clearTimeout(o.m),o.m=null);let h=o.g;o.g=null,c||Ue(o,"ready");try{h.onreadystatechange=null}catch{}}}r.isActive=function(){return!!this.g};function qt(o){return o.g?o.g.readyState:0}r.ca=function(){try{return qt(this)>2?this.g.status:-1}catch{return-1}},r.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},r.La=function(o){if(this.g){var c=this.g.responseText;return o&&c.indexOf(o)==0&&(c=c.substring(o.length)),QC(c)}};function Gl(o){try{if(!o.g)return null;if("response"in o.g)return o.g.response;switch(o.F){case"":case"text":return o.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in o.g)return o.g.mozResponseArrayBuffer}return null}catch{return null}}function pp(o){let c={};o=(o.g&&qt(o)>=2&&o.g.getAllResponseHeaders()||"").split(`\r
`);for(let d=0;d<o.length;d++){if(E(o[d]))continue;var h=ep(o[d]);let b=h[0];if(h=h[1],typeof h!="string")continue;h=h.trim();let N=c[b]||[];c[b]=N,N.push(h)}UC(c,function(d){return d.join(", ")})}r.ya=function(){return this.o},r.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Jr(o,c,h){return h&&h.internalChannelParams&&h.internalChannelParams[o]||c}function Hl(o){this.za=0,this.i=[],this.j=new Or,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Jr("failFast",!1,o),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Jr("baseRetryDelayMs",5e3,o),this.Za=Jr("retryDelaySeedMs",1e4,o),this.Ta=Jr("forwardChannelMaxRetries",2,o),this.va=Jr("forwardChannelRequestTimeoutMs",2e4,o),this.ma=o&&o.xmlHttpFactory||void 0,this.Ua=o&&o.Rb||void 0,this.Aa=o&&o.useFetchStreams||!1,this.O=void 0,this.L=o&&o.supportsCrossDomainXhr||!1,this.M="",this.h=new wl(o&&o.concurrentRequestLimit),this.Ba=new fp,this.S=o&&o.fastHandshake||!1,this.R=o&&o.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=o&&o.Pb||!1,o&&o.ua&&this.j.ua(),o&&o.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&o&&o.detectBufferingProxy||!1,this.ia=void 0,o&&o.longPollingTimeout&&o.longPollingTimeout>0&&(this.ia=o.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}r=Hl.prototype,r.ka=8,r.I=1,r.connect=function(o,c,h,d){qe(0),this.W=o,this.H=c||{},h&&d!==void 0&&(this.H.OSID=h,this.H.OAID=d),this.F=this.X,this.J=Wl(this,null,this.W),Bi(this)};function ta(o){if(Ul(o),o.I==3){var c=o.V++,h=Ct(o.J);if(ge(h,"SID",o.M),ge(h,"RID",c),ge(h,"TYPE","terminate"),Kr(o,h),c=new Gt(o,o.j,c),c.M=2,c.A=ri(Ct(h)),h=!1,a.navigator&&a.navigator.sendBeacon)try{h=a.navigator.sendBeacon(c.A.toString(),"")}catch{}!h&&a.Image&&(new Image().src=c.A,h=!0),h||(c.g=Yl(c.j,null),c.g.ea(c.A)),c.F=Date.now(),ni(c)}$l(o)}function ai(o){o.g&&(ra(o),o.g.cancel(),o.g=null)}function Ul(o){ai(o),o.v&&(a.clearTimeout(o.v),o.v=null),ui(o),o.h.cancel(),o.m&&(typeof o.m=="number"&&a.clearTimeout(o.m),o.m=null)}function Bi(o){if(!Il(o.h)&&!o.m){o.m=!0;var c=o.Ea;pe||m(),me||(pe(),me=!0),I.add(c,o),o.D=0}}function gp(o,c){return Tl(o.h)>=o.h.j-(o.m?1:0)?!1:o.m?(o.i=c.G.concat(o.i),!0):o.I==1||o.I==2||o.D>=(o.Sa?0:o.Ta)?!1:(o.m=Pr(l(o.Ea,o,c),Ql(o,o.D)),o.D++,!0)}r.Ea=function(o){if(this.m)if(this.m=null,this.I==1){if(!o){this.V=Math.floor(Math.random()*1e5),o=this.V++;let b=new Gt(this,this.j,o),N=this.o;if(this.U&&(N?(N=el(N),nl(N,this.U)):N=this.U),this.u!==null||this.R||(b.J=N,N=null),this.S)e:{for(var c=0,h=0;h<this.i.length;h++){t:{var d=this.i[h];if("__data__"in d.map&&(d=d.map.__data__,typeof d=="string")){d=d.length;break t}d=void 0}if(d===void 0)break;if(c+=d,c>4096){c=h;break e}if(c===4096||h===this.i.length-1){c=h+1;break e}}c=1e3}else c=1e3;c=jl(this,b,c),h=Ct(this.J),ge(h,"RID",o),ge(h,"CVER",22),this.G&&ge(h,"X-HTTP-Session-Id",this.G),Kr(this,h),N&&(this.R?c="headers="+Lr(Ll(N))+"&"+c:this.u&&ea(h,this.u,N)),Xo(this.h,b),this.Ra&&ge(h,"TYPE","init"),this.S?(ge(h,"$req",c),ge(h,"SID","null"),b.U=!0,Qo(b,h,null)):Qo(b,h,c),this.I=2}}else this.I==3&&(o?ql(this,o):this.i.length==0||Il(this.h)||ql(this))};function ql(o,c){var h;c?h=c.l:h=o.V++;let d=Ct(o.J);ge(d,"SID",o.M),ge(d,"RID",h),ge(d,"AID",o.K),Kr(o,d),o.u&&o.o&&ea(d,o.u,o.o),h=new Gt(o,o.j,h,o.D+1),o.u===null&&(h.J=o.o),c&&(o.i=c.G.concat(o.i)),c=jl(o,h,1e3),h.H=Math.round(o.va*.5)+Math.round(o.va*.5*Math.random()),Xo(o.h,h),Qo(h,d,c)}function Kr(o,c){o.H&&Ys(o.H,function(h,d){ge(c,d,h)}),o.l&&Ys({},function(h,d){ge(c,d,h)})}function jl(o,c,h){h=Math.min(o.i.length,h);let d=o.l?l(o.l.Ka,o.l,o):null;e:{var b=o.i;let te=-1;for(;;){let ve=["count="+h];te==-1?h>0?(te=b[0].g,ve.push("ofs="+te)):te=0:ve.push("ofs="+te);let he=!0;for(let Ne=0;Ne<h;Ne++){var N=b[Ne].g;let pt=b[Ne].map;if(N-=te,N<0)te=Math.max(0,b[Ne].g-100),he=!1;else try{N="req"+N+"_"||"";try{var G=pt instanceof Map?pt:Object.entries(pt);for(let[dn,jt]of G){let Jt=jt;B(jt)&&(Jt=qo(jt)),ve.push(N+dn+"="+encodeURIComponent(Jt))}}catch(dn){throw ve.push(N+"type="+encodeURIComponent("_badmap")),dn}}catch{d&&d(pt)}}if(he){G=ve.join("&");break e}}G=void 0}return o=o.i.splice(0,h),c.G=o,G}function Jl(o){if(!o.g&&!o.v){o.Y=1;var c=o.Da;pe||m(),me||(pe(),me=!0),I.add(c,o),o.A=0}}function na(o){return o.g||o.v||o.A>=3?!1:(o.Y++,o.v=Pr(l(o.Da,o),Ql(o,o.A)),o.A++,!0)}r.Da=function(){if(this.v=null,Kl(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var o=4*this.T;this.j.info("BP detection timer enabled: "+o),this.B=Pr(l(this.Wa,this),o)}},r.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,qe(10),ai(this),Kl(this))};function ra(o){o.B!=null&&(a.clearTimeout(o.B),o.B=null)}function Kl(o){o.g=new Gt(o,o.j,"rpc",o.Y),o.u===null&&(o.g.J=o.o),o.g.P=0;var c=Ct(o.na);ge(c,"RID","rpc"),ge(c,"SID",o.M),ge(c,"AID",o.K),ge(c,"CI",o.F?"0":"1"),!o.F&&o.ia&&ge(c,"TO",o.ia),ge(c,"TYPE","xmlhttp"),Kr(o,c),o.u&&o.o&&ea(c,o.u,o.o),o.O&&(o.g.H=o.O);var h=o.g;o=o.ba,h.M=1,h.A=ri(Ct(c)),h.u=null,h.R=!0,_l(h,o)}r.Va=function(){this.C!=null&&(this.C=null,ai(this),na(this),qe(19))};function ui(o){o.C!=null&&(a.clearTimeout(o.C),o.C=null)}function zl(o,c){var h=null;if(o.g==c){ui(o),ra(o),o.g=null;var d=2}else if(Yo(o.h,c))h=c.G,Al(o.h,c),d=1;else return;if(o.I!=0){if(c.o)if(d==1){h=c.u?c.u.length:0,c=Date.now()-c.F;var b=o.D;d=ei(),Ue(d,new Cl(d,h)),Bi(o)}else Jl(o);else if(b=c.m,b==3||b==0&&c.X>0||!(d==1&&gp(o,c)||d==2&&na(o)))switch(h&&h.length>0&&(c=o.h,c.i=c.i.concat(h)),b){case 1:fn(o,5);break;case 4:fn(o,10);break;case 3:fn(o,6);break;default:fn(o,2)}}}function Ql(o,c){let h=o.Qa+Math.floor(Math.random()*o.Za);return o.isActive()||(h*=2),h*c}function fn(o,c){if(o.j.info("Error code "+c),c==2){var h=l(o.bb,o),d=o.Ua;let b=!d;d=new Ht(d||"//www.google.com/images/cleardot.gif"),a.location&&a.location.protocol=="http"||kr(d,"https"),ri(d),b?lp(d.toString(),h):hp(d.toString(),h)}else qe(2);o.I=0,o.l&&o.l.pa(c),$l(o),Ul(o)}r.bb=function(o){o?(this.j.info("Successfully pinged google.com"),qe(2)):(this.j.info("Failed to ping google.com"),qe(1))};function $l(o){if(o.I=0,o.ja=[],o.l){let c=bl(o.h);(c.length!=0||o.i.length!=0)&&(R(o.ja,c),R(o.ja,o.i),o.h.i.length=0,v(o.i),o.i.length=0),o.l.oa()}}function Wl(o,c,h){var d=h instanceof Ht?Ct(h):new Ht(h);if(d.g!="")c&&(d.g=c+"."+d.g),Mr(d,d.u);else{var b=a.location;d=b.protocol,c=c?c+"."+b.hostname:b.hostname,b=+b.port;let N=new Ht(null);d&&kr(N,d),c&&(N.g=c),b&&Mr(N,b),h&&(N.h=h),d=N}return h=o.G,c=o.wa,h&&c&&ge(d,h,c),ge(d,"VER",o.ka),Kr(o,d),d}function Yl(o,c,h){if(c&&!o.L)throw Error("Can't create secondary domain capable XhrIo object.");return c=o.Aa&&!o.ma?new Ee(new si({ab:h})):new Ee(o.ma),c.Fa(o.L),c}r.isActive=function(){return!!this.l&&this.l.isActive(this)};function Xl(){}r=Xl.prototype,r.ra=function(){},r.qa=function(){},r.pa=function(){},r.oa=function(){},r.isActive=function(){return!0},r.Ka=function(){};function ci(){}ci.prototype.g=function(o,c){return new Xe(o,c)};function Xe(o,c){Ve.call(this),this.g=new Hl(c),this.l=o,this.h=c&&c.messageUrlParams||null,o=c&&c.messageHeaders||null,c&&c.clientProtocolHeaderRequired&&(o?o["X-Client-Protocol"]="webchannel":o={"X-Client-Protocol":"webchannel"}),this.g.o=o,o=c&&c.initMessageHeaders||null,c&&c.messageContentType&&(o?o["X-WebChannel-Content-Type"]=c.messageContentType:o={"X-WebChannel-Content-Type":c.messageContentType}),c&&c.sa&&(o?o["X-WebChannel-Client-Profile"]=c.sa:o={"X-WebChannel-Client-Profile":c.sa}),this.g.U=o,(o=c&&c.Qb)&&!E(o)&&(this.g.u=o),this.A=c&&c.supportsCrossDomainXhr||!1,this.v=c&&c.sendRawJson||!1,(c=c&&c.httpSessionIdParam)&&!E(c)&&(this.g.G=c,o=this.h,o!==null&&c in o&&(o=this.h,c in o&&delete o[c])),this.j=new Gn(this)}C(Xe,Ve),Xe.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},Xe.prototype.close=function(){ta(this.g)},Xe.prototype.o=function(o){var c=this.g;if(typeof o=="string"){var h={};h.__data__=o,o=h}else this.v&&(h={},h.__data__=qo(o),o=h);c.i.push(new rp(c.Ya++,o)),c.I==3&&Bi(c)},Xe.prototype.N=function(){this.g.l=null,delete this.j,ta(this.g),delete this.g,Xe.Z.N.call(this)};function Zl(o){jo.call(this),o.__headers__&&(this.headers=o.__headers__,this.statusCode=o.__status__,delete o.__headers__,delete o.__status__);var c=o.__sm__;if(c){e:{for(let h in c){o=h;break e}o=void 0}(this.i=o)&&(o=this.i,c=c!==null&&o in c?c[o]:void 0),this.data=c}else this.data=o}C(Zl,jo);function eh(){Jo.call(this),this.status=1}C(eh,Jo);function Gn(o){this.g=o}C(Gn,Xl),Gn.prototype.ra=function(){Ue(this.g,"a")},Gn.prototype.qa=function(o){Ue(this.g,new Zl(o))},Gn.prototype.pa=function(o){Ue(this.g,new eh)},Gn.prototype.oa=function(){Ue(this.g,"b")},ci.prototype.createWebChannel=ci.prototype.g,Xe.prototype.send=Xe.prototype.o,Xe.prototype.open=Xe.prototype.m,Xe.prototype.close=Xe.prototype.close,Na=bt.createWebChannelTransport=function(){return new ci},Ra=bt.getStatEventTarget=function(){return ei()},Sa=bt.Event=cn,gi=bt.Stat={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},ti.NO_ERROR=0,ti.TIMEOUT=8,ti.HTTP_ERROR=6,Yr=bt.ErrorCode=ti,pl.COMPLETE="complete",va=bt.EventType=pl,ll.EventType=Fr,Fr.OPEN="a",Fr.CLOSE="b",Fr.ERROR="c",Fr.MESSAGE="d",Ve.prototype.listen=Ve.prototype.J,qn=bt.WebChannel=ll,Sg=bt.FetchXmlHttpFactory=si,Ee.prototype.listenOnce=Ee.prototype.K,Ee.prototype.getLastError=Ee.prototype.Ha,Ee.prototype.getLastErrorCode=Ee.prototype.ya,Ee.prototype.getStatus=Ee.prototype.ca,Ee.prototype.getResponseJson=Ee.prototype.La,Ee.prototype.getResponseText=Ee.prototype.la,Ee.prototype.send=Ee.prototype.ea,Ee.prototype.setWithCredentials=Ee.prototype.Fa,ba=bt.XhrIo=Ee}).apply(typeof pi<"u"?pi:typeof self<"u"?self:typeof window<"u"?window:{});/*!
* re2js
* RE2JS is the JavaScript port of RE2, a regular expression engine that provides linear time matching
*
* @version v2.8.6
* @author Oleksii Vasyliev
* @homepage https://github.com/le0pard/re2js#readme
* @repository github:le0pard/re2js
* @license MIT
*/var O=class gn{static FOLD_CASE=1;static LITERAL=2;static CLASS_NL=4;static DOT_NL=8;static ONE_LINE=16;static NON_GREEDY=32;static PERL_X=64;static UNICODE_GROUPS=128;static WAS_DOLLAR=256;static LOOKBEHIND=512;static MATCH_NL=gn.CLASS_NL|gn.DOT_NL;static PERL=gn.CLASS_NL|gn.ONE_LINE|gn.PERL_X|gn.UNICODE_GROUPS;static POSIX=0;static UNANCHORED=0;static ANCHOR_START=1;static ANCHOR_BOTH=2},lt={CASE_INSENSITIVE:1,DOTALL:2,MULTILINE:4,DISABLE_UNICODE_GROUPS:8,LONGEST_MATCH:16,LOOKBEHINDS:512},es=128,Oa=new Int32Array(es),La=new Int32Array(es),mi=65535;for(let r=0;r<es;r++)r>=97&&r<=122?Oa[r]=r-32:Oa[r]=r,r>=65&&r<=90?La[r]=r+32:La[r]=r;var F=class{static CODES=new Map([["\x07",7],["\b",8],["	",9],[`
`,10],["\v",11],["\f",12],["\r",13],[" ",32],['"',34],["$",36],["&",38],["'",39],["(",40],[")",41],["*",42],["+",43],["-",45],[".",46],["0",48],["1",49],["2",50],["3",51],["4",52],["5",53],["6",54],["7",55],["8",56],["9",57],[":",58],["<",60],[">",62],["?",63],["A",65],["B",66],["C",67],["F",70],["P",80],["Q",81],["U",85],["Z",90],["[",91],["\\",92],["]",93],["^",94],["_",95],["`",96],["a",97],["b",98],["f",102],["i",105],["m",109],["n",110],["r",114],["s",115],["t",116],["v",118],["x",120],["z",122],["{",123],["|",124],["}",125]]);static toUpperCase(r){if(r<es)return Oa[r];let e=String.fromCodePoint(r).toUpperCase(),t=e.codePointAt(0)>mi?2:1;if(e.length>t)return r;let n=String.fromCodePoint(e.codePointAt(0)).toLowerCase(),s=n.codePointAt(0)>mi?2:1;return n.length>s||n.codePointAt(0)!==r?r:e.codePointAt(0)}static toLowerCase(r){if(r<es)return La[r];let e=String.fromCodePoint(r).toLowerCase(),t=e.codePointAt(0)>mi?2:1;if(e.length>t)return r;let n=String.fromCodePoint(e.codePointAt(0)).toUpperCase(),s=n.codePointAt(0)>mi?2:1;return n.length>s||n.codePointAt(0)!==r?r:e.codePointAt(0)}},p=class{constructor(r,e=!1){this.data=r,this.isStride1=e,this.SIZE=e?2:3}getLo(r){return this.data[r*this.SIZE]}getHi(r){return this.data[r*this.SIZE+1]}getStride(r){return this.isStride1?1:this.data[r*this.SIZE+2]}get length(){return this.data.length/this.SIZE}},af=new Uint8Array(256);for(let r=0,e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-";r<64;r++)af[e.charCodeAt(r)]=r;var Bf=r=>{let e=[],t=0,n=0;for(let s=0;s<r.length;s++){let i=af[r.charCodeAt(s)];t|=(i&31)<<n,(i&32)===0?(e.push(t),t=0,n=0):n+=5}return e},g=(r,e)=>{let t=Bf(r),n=e?t.length/2:t.length/3,s=new Uint32Array(n*3),i=0,a=0;for(let B=0;B<n;B++)i+=t[a++],s[B*3]=i,i+=t[a++],s[B*3+1]=i,s[B*3+2]=e?1:t[a++];return s},Rg=r=>{let e=Bf(r),t=new Map,n=0;for(let s=0;s<e.length;s+=2){n+=e[s];let i=e[s+1],a=i>>>1^-(i&1);t.set(n,n+a)}return t},Ei=class{constructor(r){this.initializer=r,this.cache=new Map}has(r){return r in this.initializer}get(r){if(this.cache.has(r))return this.cache.get(r);let e=this.initializer[r],t=e?e():null;return this.cache.set(r,t),t}},Qe=class{static _CASE_ORBIT=null;static get CASE_ORBIT(){return this._CASE_ORBIT||(this._CASE_ORBIT=Rg("rCgCIgCY+rQI4QiCuuBLgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCCgCBgCBgCBgCBgCBgCBgCB+7OB-BB-BB-BB-BB-BBskQB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BC-BB-BB-BB-BB-BB-BB-BByHBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBDCBBBCBBBCBBCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBxHBCBBBCBBBCBBB3SBmMBkNBCBBBCBBB8MBCBBB6MB6MBCBBC+EB0MB2MBCBBB6MB+MBiGBmNBiNBCBBBmKBikzCBmNBqNBkIBsNBCBBBCBBBCBBB0NBCBBB0NDCBBB0NBCBBByNByNBCBBBCBBB2NBCBBDCBBCwDFCBCBDBCBCBDBCBCBDBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBB9EBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCCBCBDBCBBBhGBvDBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBjICCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBH2iVBCBBBlKBwiVB+jVB+jVBCBBBlMBqEBuEBCBBBCBBBCBBBCBBBCBBB+hVB4hVB8hVBjNB7MC5MB5MCzMC1MB+0yCE5MB20yCC9MBu2yCBwyyCBo0yCChNBlNBo0yCBu-UBi0yCDlNC6-UBpNDrNIu+UDzNCm0yCBzNE0yyCBzNBpEBxNBxNBtEG1NLqxyCBkxyCnFoFrBCBBBCBBDCBBEkIBkIBkICoHHsCCqCBqCBqCCgEC+DB+DBmkOBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCC+BBgCBgCBgCBgCBgCBgCBgCBgCBrCBpCBpCBpCBmjOB-BB8BB-BB-BBgEB-BB-BByBBqgOBsDB-BBtwBB-BB-BB-BBsBBgDBCB-BB-BB-BBeB-BB-BB61OB-BB-BB-DB9DB9DBQB7DBmCE9CBrDBPBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBrFB-EBOBnHB3FB-FCCBBBNBCBBCjIBjIBjIBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB8kMB-BB6kMB-BB-BB-BB-BB-BB-BB-BB-BB-BBokMB-BB-BBkkMBkkMB-BB-BB-BB-BB-BB-BB-BB4jMB-BB-BB-BB-BB-BB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EBCBBBCBoiMBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBJCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBeBCBBBCBBBCBBBCBBBCBBBCBBBCBBBdBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDL-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-C64CgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOCgmOGgmODg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FDg8FBg8FBg8FhVg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBQBQBQBQBQBQDPBPBPBPBPBPjkC7mMB5mMBnmMBjmMBCBlmMB3lMBpiMBk8kCBCBBG-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FD-7FB-7FB-7F6FoglCEsuHRwjlCyDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCB0DBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBG1DD97OCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQDPBPBPBPBPBPDQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQDPBPBPBPBPBPEQCQCQCQCPCPCPCPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPB0EB0EBsFBsFBsFBsFBoGBoGBgIBgIBgHBgHB8HB8HDQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQCSFPBPBzEBzEBRCxnOFSFrFBrFBrFBrFBREQBQClkOFPBPBnGBnGFQBQCljOCODPBPB-GB-GBNHSF-HB-HB7HB7HBRqJ53OE9tQBrmQH4Bc3BSgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBfBfBfBfBfBfBfBfBfBfBfBfBfBfBfBfECBByZ0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzB34BgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CBCBBBt-UBruHBt+UB1iVBviVBCBBBCBBBCBBB3hVB5-UB9hVB7hVCCBBCCBBI9jVB9jVBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBICBBBCBBECBBN-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOC-lOG-lOzoeCBBBCBBBCBBBCBBBCBBBCBl8kCBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBTCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBnECBBBCBBBCBBBCBBBCBBBCBBBCBBDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBKCBBBCBBBnglCBCBBBCBBBCBBBCBBBCBBECBBBvyyCDCBBBCBBBgDCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBn0yCB90yCB10yCBh0yCBn0yCCjxyCBzyyCBpxyCBg6BBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBB-CBl0yCBvjlCBCBBBCBBBt2yCBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBhkzCZCBB9a-5Bd-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCm6TCBB7gBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCH-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BmlBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvChDwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCFvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvC1DuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCCuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCCuCBuCBuCBuCBuCBuCBuCCuCBuCCtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCCtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCCtCBtCBtCBtCBtCBtCBtCCtCBtCk2BgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEO-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-D+CgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCL-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-B74CgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BhrVgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BhB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BD1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BtxekCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjC")),this._CASE_ORBIT}static _Print=null;static get Print(){return this._Print||(this._Print=new p(g("hB9CBjBLBCpWBDFBFGBCCCBSBCsMBClBBDxBBDCBC2BBJaBFFBSVBC-FBCvBBD6BBDkDBP6BBDwBBDOBCbBDCCBJBGfBIqCBCgFBCHBDBBDVBCGBCEEBCBDIBDBBDDBJFFBCCBDBDYBDCBCFBFBBDVBCGBCBBCBBCBBDCCBDBFBBDCBEIIBCBCIIBPBLCBCIBCCBCVBCGBCBBCEBDJBCCBCCBDQQBCBDLBIGBCCBCHBDBBDVBCGBCBBCEBDIBDBBDCBICBFBBCEBDRBLBBCFBECBCDBEBBCCCBEEBEEBBBELBFEBECBCDBDHHPUBGMBCCBCWBCPBDIBCCBCDBIBBCCBCBBDDBDJBIVBCCBCWBCJBCEBDIBCCBCDBIBBGCBCDBDJBCCBNMBCCBCyBBCCBCFBFPBDZBCCBCRBEXBCIBCDDBFBEFFBEBCCCBGBHJBDCBN5BBFcBmBBBCCCBDBCXBCCCBVBDEBCCCBFBCJBDDBhBnCBCjBBFmBBCjBBCOBCMBmBlGBCGGD4LBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBDfBEZBH1CBDFBD-TBCbBE4CBIVBKXBKTBNMBCCBCBBN9CBDJBHJBHNBCKBH4CBIqBBGlCBLeBCLBFLBFEEBoBBDEBMrBBFZBHKBE9BBDgCBCcBDKBHJBHNBDtBBDLBVsCBClFBJ7BBEOBE9BBGqBBDKBJqBBG1QBDFBDlBBDFBDHBCGCBdBD0BBCOBCNBDFBCSBDCBCIBSXBJuBBSBBDaBCMBEhBBPgBBQrEBF5UBXKBWz4BBD9LBGsBBCGGD3BBIBBPXBKGBCGBCGBCGBCGBCGBCGBCGBC9DBjBZBC4CBN1GBbPBC+BBC1CBDmDBGqBBC9CBC1CBKvBBCszcBE2BBK7KBV3FBJ8GBV7BBEJBH3BBJlCBJLBHzDBMdBEtCBCKBFgBBC2BBKNBDJBDmDBZbBLFBDFBDFBKGBCGBC7BBF9DBDJBHj9KBNWBFwBBloItLBDpDBnBGBNEBGZBCEBCCCBCCBCCBoUBhBpBBHyBBCSBCDBFEBCmEBF9FBEFBDFBDFBDCBEGBCGBOBBDLBCZBCSBCBBCOBDNBjB6DBGCBFsBBE3CBCMBEwBwBBsBBjEcBEwBBQbBFjBBKdBGqBBGdBCkBBFNBrB9EBDJBHjBBFjBBFnBBJzBBMLBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBCnCBJIBxBSBCBBGgBBEaBGaBnB3BBFTBDxBBCBBGHBCCBCcBDCBFJBIIBI-BBhBmBBFLBK1BBEcBDaBGZBIDBNGBxCoCB4ByBBOyBBItBBJJBHlBBEcBJBBxGeBCpBBCCBDBBRFBJIBiBtBBJpBBXZBnBbBVWBKtCBFjBBK9BBCEBOYBIJBH0BBCRBJmBBK-CBCTBMRBCuBB-BGBCCCBCBCOBCKBH6BBGJBHDBCHBDBBDVBCGBCBBCEBCJBDBBDCBDHHGGBDGBEEBMJBCDDClBBCJBCDDCDBCJBCBBJBBe7CBCEBfnCBJJBnF1BBDlBBjBkCBMJBHMBU5BBHJBHTBdaBDOBFWB6F7BBlDyCBNHBDDDBGBCBBCdBCBBDLBKJBnCHBDtBBDKBcnCBJyCBOoCBIJB3CHB5ChBBPJBHIBCsBBCNBLcBEfBDVBCNBqCGBCBBCrBBECCBCCBHBJJBHFBCBBCkBBCBBCFBIJBHrBBFJB3HYBIQBCoBBEcB2CQQBwBBO6cBnDuDBCEBMjGBtyCiDBOvhBBRVBL68DBGmSB61G5BBn2B4RBIeBCJBFwCBCJBHdBDFBLlCBLJBCGBCUBGSBxN5BBnG6CBGYBDYBtBqCBF4BBIQBhCEBMGBK1mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBDDBh7D8HBEzNBHWBQQBQtBBDWBKzDB9B1HBLmBBDpCBJvDBWlCB7DTBNTBN2CBKYBoE0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBD9VBQEBCOBxiBeBHFB2GGBCQBDGBCBBCEBG9BBiBxDxDBrBBENBDJBFBBhKeBS5BBGxOxOBoBB3GqBBFhGhGBdBCVBJBBhHGBCDBCBBCOBCkGBDPBqBrCBFJBFBByYjCBtC8BBjGDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBBvIrBBFjDBNOBDOBCOBCkBBLtFB5BcBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBCmDBmgB-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIBnkzVvHB",!1))),this._Print}static CATEGORIES=new Ei({C:()=>new p(g("AfBgDgBBOrWrWBHHBCBICCVuMuMnBBBzBBBE4B4BBGBcDBHQBXhGhGxBBB8BBBmDNB8BBByBBBQddBCCMEBhBGBsCiFiFJBBDBBXIICCBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBPMMBEB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKMMBDBbEByBPBDBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBjoIBvLBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCB-FCBHBBHBBHBBECBIIIBLBDBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIB-BGGBLBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMBxhBPBXJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBF-6DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBrCHBxDUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIlkzVBxHvw-FB",!1)),Cc:()=>new p(g("AfgDgB",!0)),Cf:()=>new p(g("tFzqBzqBBEBXhGhGyBhMhMBxCxCs5D9-B9-BBDBbEByBEBCJBw03B6H6HBBBimEQQj7IPBhjiBDBwmFHBn0rYffB+CB",!1)),Cn:()=>new p(g("4bBBHDBICCVuMuMnBBBzBBBE4B4BBGBcDBHKBvI9B9BBmDmDBMB8BBByBBBQddBCCMEBjBEBuHJJBDDBXXICCBBBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBbFB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKmDmDNBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBDBvzIBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCC-FCBHBBHBBHBBECBIIIBIBGBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIBlCJBCBBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMB3iBJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBJ76DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBjGUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIm8yVBCdBhD-DBxHvw-BB---BBB---BBB",!1)),Co:()=>new p(g("gg4B-nGh4hc9--BD9--B",!0)),Cs:()=>new p(g("gg2B--B",!0)),L:()=>new p(g("hCZBHZBwBLLFGGBVBCeBCpOBFLBPEBICCiEEBCBBDDBCHHCCBCCCBSBCyCBCqEBJlFBClBBDHHBnBBoCaBFDBuBqBBkBBBCiDBCQQBIIBLLBBBDRRCdBe4CBMZZBfBKBBFGGBUBFKKEYYBXBIKBGXBCGBRpBB7B1BBETTIJBQPBFHBDBBDVBCGBCEEBCBERROBBCCBPBBLJJBEBFBBDVBCGBCBBCBBCBBgBDBCUUBBBRIBCCBCVBCGBCBBCEBETTQBBYMMBGBDBBDVBCGBCBBCEBEffBCCBBBQSSCFBECBCDBEBBCCCBEEBEEBBBELBX1B1BBGBCCBCWBCPBEbbBBBCBBDBBfFFBGBCCBCWBCJBCEBEffBBBCBBQBBSIBCCBCoBBDRRGCBJCBZFBGRBEXBCIBCDDBFB7BvBBCBBNGB7BBBCCCBDBCXBCCCBIBCBBKDDBDBCWWBCBhBgCgCBGBCjBBcEB0DqBBVRRBEBFDBEEEBIIBBBFMBNSSBkBBCGGDqBBCsKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPBR1CBDFBErTBDQBCZBGqCBHHBIRBOSBPRBPMBCCBQzBBkBFFkC4CBIEBDhBBCGGBkCBLeByBdBDEBMrBBFZB3BWBK0BBzC+C+CBtBBSHB3BdBOBBLrBBbjBBqBCBLjBBDKBGqBBDCBqBDBCFBCBBEGGB+FBhC1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGB1DOORMBmDFFDJBCEEBDBHGCBCBCKBDDBGEBF1B1BB8zC8zCBjHBHDBEBBNlBBCGGD3BBIRRBVBKGBCGBCGBCGBCGBCGBCGBCGBxC2O2OBrBrBBDBGBBF1CBHCBC5CBCDBGqBBC9CBSfBxBPBhQ-tGBhCs0VBkCtBBDsIBEPBLBBVuBBReBDlCByBIBDmDBDxCBVQBCCBCDBCWBezBBPxBB-BFBECCBMMBaBLWBacBIuBBdRRBDBCJBLEBCoBBYCBCHBVWBEEEBwBBCEEBDDBDBDCCZCBDKBICBNFBDFBDFBKGBCGBCqBBCNBHyDBej9KBNWBFwBBloItLBDpDBnBGBNEBGCCBIBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBlBZBHZBM4CBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmMcBEwBBwBfBOTBCHBHlBBLdBDjBBFHBxB9EBTjBBFjBBFnBBJzBBNKBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCQQBCBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4ByBBOyBBOjBBnBbBKWB7HpBBHBBRFB5BcBLJJBUBrBRBvBUBcWBN0BB6BBBDOOBrBBhBYBbjBBeDDJiBBENNBuBBPDBWCCkBRBCYBUBBgCGBCCCBCBCOBCJBIuBBnBHBDBBDVBCGBCBBCEBETTNEBfJBCDDClBBCaaCtBtBBzBBTDBVCBfvBBVBBC5F5FBtBBqBDBlBvBBV8B8BBpBBOoCoCBZBmBGB6FrBB1D-BBgBHBDDDBGBCBBCXBQCC-CHBDmBBRCCdLLBmBBIWWMtBBUTTBnCBoGgBBgBIBCkBBSyByBBcBxDGBCBBClBBWaaBEBCBBCfBPYYBqBBlISBQCCBLBChBB9DwCwCB4cBnHjGBtyCgDBQvhBBSFBa68DBGmSB61GdBj3B4RBIeBSuCBSdBTvBBRDBgBUBGSBxNsBB0G-BBhBYBDYBtBqCBGjCjCBLBhCBBCPPBNNB0mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBn7F0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BeBHFBmI9BBzEsBBLGBRiKiKBcBTrBBlPbBlHdBDwGwGBdBCCBCBBCGBDEBKBBhHGBCDBCBBCOBCkGB8BjCBI1lB1lBBCBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQBlqE-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB",!1)),LC:()=>new p(g("hCZBHZB7BLLBVBCeBCiGBCDBFvGBDZBhGDBDBBECBCHHCCBCCCBSBCyCBCqEBJlFBClBBKoBB44ClBBCGGDqBBDCBhV1CBDFBjkCKBGqBBDCBhCrBBgCMBChBBmD1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGBmIFFDJBCEEBDBHGCBCBCFBFDDBCBGEBF1B1BB8zC8zCB6DBDmDBHDBEBBNlBBCGGzoetBBTbBnEtCBCWBEDBCsCBZBBE2Z2ZBpBBGIBIvCBh6TGBNEBqgBZBHZBmlBvCBhDjBBFjBB1DKBCOBCGBCBBCKBCOBCGBCBBk2ByBBOyBB+CVBLVB74C-BBhrV-BBhBYBDYBtpZ0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BJBCTBHFB2uCjCB",!1)),Ll:()=>new p(g("hDZB7BqBqBBWBCHBC2BCBQCBuBCDECBBBDCCDEEBFFDEEBBBDDDCCCDCCBCCDEECDDBDDBBBHGDCOCBSCBDDCEEC4BCBFBDDDBCCFICBjCBDZBiGCCEEEBBBTccBhBBCBBECBCWCBDBCGDB0B0BBuBBCgBCK0BCDMCBgDCxBoBBo6CqBBDCB5XFBjkCIBC2D2DBqBBgCMBChBBnD0ECBHBCgDCBHBJFBLHBJHBJFBLHBJHBJNBDHBJHBJHBJEBCBBHEEBBBCBBJDBDBBJHBLCBCBBzIEEBEEcKFDBBJDBF2B2Bs1CvBBCEEBGCFCCBCCBEBGiDCBIICFFNlBBCGG0oesBCUaCoEMCBBBC+BCBGBCCCDICFCCDCCBBBCSCGGGCMCFCCDOCbEE2ZqBBGIBIvCBh6TGBNEBqhBZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBnqZZBbGBCRBbZBbDBCCCBFBCKBbZBbZBbZBbZBbZBbZBbZBbZBbbBdYBCFBbYBCFBbYBCFBbYBCFBbYBCFBC15B15BBIBCTBHFB4vChBB",!1)),Lm:()=>new p(g("wVRBFLBPEBICCmEGG-OnHnHlFBBuIBBFgBgBKEEhFoFoF1mBgEgE2R72B72BsDkTkTxOFBvF+BBOjBjBBjBByVOORMBg-CBByHgGgG2OsBsBBDBGiDiDB+C+CBBB34bjnBjnBBEBvIzDzDdBB6DIBxCYYpDDBEBB2OXXqEtDtDWBBoDDBKngVngVuBBBh-BFBCpBBCIB0sBhBhB2K04D04DnrTDB9PCBpBBBnRMBhCBBCPPB9-P9-PBCBCGBCBByhM9BBqGGBud0Q0QsSAB",!1)),Lo:()=>new p(g("qFQQhIFFBCBxGBB7ZaBFDBuBfBCJBkBBBCiDBCZZBLLBBBDRRCdBe4CBMZZBfBWVBrBYBIKBGXBCGBRoBB8B1BBETTIJBROBFHBDBBDVBCGBCEEBCBERROBBCCBPBBLJJBEBFBBDVBCGBCBBCBBCBBgBDBCUUBBBRIBCCBCVBCGBCBBCEBETTQBBYMMBGBDBBDVBCGBCBBCEBEffBCCBBBQSSCFBECBCDBEBBCCCBEEBEEBBBELBX1B1BBGBCCBCWBCPBEbbBBBCBBDBBfFFBGBCCBCWBCJBCEBEffBBBCBBQBBSIBCCBCoBBDRRGCBJCBZFBGRBEXBCIBCDDBFB7BvBBCBBNFB8BBBCCCBDBCXBCCCBIBCBBKDDBDBYDBhBgCgCBGBCjBBcEB0DqBBVRRBEBFDBEEEBIIBBBFMBNyDyDBnKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPByDrTBDQBCZBGqCBHHBIRBOSBPRBPMBCCBQzBBpBkCkCBhBBC0BBIEBDhBBCGGBkCBLeByBdBDEBMrBBFZB3BWBK0BBxFuBBSHB3BdBOBBLrBBbjBBqBCBLdByDDBCFBCBBE7hB7hBBCB4-C3BBZWBKGBCGBCGBCGBCGBCGBCGBCGBoR2B2BF1CBJCCB4CBFGGBpBBC9CBSfBxBPBhQ-tGBhC0wUBC2jBBkCnBBJrIBFPBLBBjCyByBBkCBqFoDoDEGBCCBCDBCWBezBBPxBB-BFBECCBMMBaBLWBacBIuBBuBEBDIBLEBCoBBYCBCHBVPBCFBEEEBwBBCEEBDDBDBDCCZBBEKBIPPBEBDFBDFBKGBCGByEiBBej9KBNWBFwBBloItLBDpDBkCCCBIBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBqDJBCsBBDeBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmMcBEwBBwBfBOTBCHBHlBBLdBDjBBFHBhEtCBjDnBBJzBB9CzBBN2JBKVBLHB5EFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCQQBCBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4FjBBnBDBCxJxJBoBBHBBRCBCBB5BcBLJJBUBrBRBvBUBcWBN0BB6BBBDOOBrBBhBYBbjBBeDDJiBBENNBuBBPDBWCCkBRBCYBUBBgCGBCCCBCBCOBCJBIuBBnBHBDBBDVBCGBCBBCEBETTNEBfJBCDDClBBCaaCtBtBBzBBTDBVCBfvBBVBBC5F5FBtBBqBDBlBvBBV8B8BBpBBOoCoCBZBmBGB6FrBB0GHBDDDBGBCBBCXBQCC-CHBDmBBRCCdLLBmBBIWWMtBBUTTBnCBoGgBBgBIBCkBBSyByBBcBxDGBCBBClBBWaaBEBCBBCfBPYYBnBBCBBlISBQCCBLBChBB9DwCwCB4cBnHjGBtyCgDBQvhBBSFBa68DBGmSB61GdBj3B4RBIeBSuCBSdBTvBB0BUBGSB0NnBB2MqCBGwFwFB0mHBqBfBiDyDBuwIiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBxzI2P2PBrBBiBiKiKBcBTrBBlPaBmHdBDwGwGBdBCCBCBBCGBDEBKiHiHBFBCDBCBBCOBCkGB8pBDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQBlqE-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB",!1)),Lt:()=>new p(g("lOGDnB2sH2sHBGBJHBJHBNQQwBAB",!1)),Lu:()=>new p(g("hCZBmDWBCGBiB2BCDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIJDCMCDQCDDDCCBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBDDBBBEWCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBpCDBNDBNDBNEBMDBnIFFECBDCBDEEBDBHGCBCBDDBLBBG+B+B9zCvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoqZZBbZBbZBbCCBGDBDDBCBCHBbZBbBBCDBDHBCGBcBBCDBCEBCEEBFBcZBbZBbZBbZBbZBbZBfYBiBYBiBYBiBYBiBYBiB2pE2pEBgBB",!1)),M:()=>new p(g("gYvDB0IGBoIsBBCCCBCCBCCpCKBxBUBRmDmDBFBDFBDBBCDBkBffBZB8CKB7BIBKZZBCBCIBCCBCEBsBCB8BIBrBXBCgBB3BCBCRBCGBLBBeCB5BCCBFBDBBDCBKLLBbbDCB5BCCBDBFBBDCBEffBEEMCB5BCCBGBCCBCCBVBBXFBCCB5BCCBFBDBBDCBICBLBBf8B8BBDBECBCDBKpBpBBDB4BCCBFBCCBCDBIBBMBBeCB5BCCBFBCCBCDBIBBMBBQNNBCB4BBBCGBCCBCDBKLLBeeBBBnCFFBEBCCCBGBTBB+BDDBFBNHBjDDDBHBMGBqCBBcECFBByBTBCBBGKBCjBBKlDlDBSBYDBFCBCCBDGBEDBOLBCLLBCBgWCBzdDBdCBeBBfBBhCfBKuBuBBBBC2D2DBjBjB3DLBFLB8GEB6BJBCcBDxBxBBsBBDLBVEBwBQBnBIBNCBfMB5BNBxBTB5ECBCUBFHHDCBnG-BBxWgBB--CCBuEhDhDBeBrRFBqDBB1udDBCJBhBBBxCBBxIEEFYYBDBF0C0CBzBzBBQBbRBOnBnBBGBaMBtBDBwBNBlBkCkCBMBNJJBuBuBBBBzBCCBBBDBBGBBCqBqBBDBGBBtHHBCBBx5TiXiXBOBRPBuejHjH2EEBn0BCBCBBGDBpBCBFmFmFB+R+RBCBiCEB+JBBuCFBnCKByBDB7DCB2BOBqBDDBLLBCBuBKBI+B+BBBBlBNBRBBtBNNBBBxBNBJDBCBB9CLBHDD+ELBWDB4BBBCGBDBBDCBKLLBDDBFBEEBkCIBCDDCDBCEBCPPBzCzCBQBYyCyCBSBsHGBDIBcBBzCQBrDMBmDOBhIOB2HFBCBBDDBCCCBuEuEBFBDGBEddBIBpBGBCDBJKKBJBvBPBnGHBoGHBCHBzCVBCNB7DFBECCBCCBFBCjCjCBDBCBBCEB8KDBKBBCxBxBBFBEEBYmnFmnFHOBpmLRBhuCEB8BGB5gBCCB1BBIDByCMMBslTslTBizEizEBsBBDWB-QEBEFBJHBDGBfDB1ECB89B2BBFxBBJPPXEBCOBxqBGBCQBDGBCBBCEBlDhFhFBFB4L+B+BBCB9PDB-HBB0HDDIBBG7O7OBFBuDGB29lYvHB",!1)),Mc:()=>new p(g("joC4B4BDCBJDBCBBzBBB7BCBHBBDBBLsBsB7BCBjC7B7BBBBJCCB2B2BB7B7BCHHBDDBLLnDBBCBBECBCCBLqBqBBBB+BDB+BBB7BCCBDBDBBCBBKBBdPPB7B7BBBBGCBCCBLrBrBBsCsCBBBHHBTBBrKBBgCsFsFBFFHDDBaaBLLBBBDGBWBBDFBDLLBBB5zBffiEIIBGBCBB7KDBDCBFBBCFBhHBB7BCCKCCBJJBEByExBxBGCCBDBCBB+BffFBBD9B9BDCBCEEBxBxBBGBJBBsFWW35EBB0-dBBD5C5CBzBzBBOBvEBBwBxBxBBFFBDDBBBvDBBDBBZuBuBCuDuDDBBGuHuHBCCBCCBCC0gZCCgEuBuBBBBFBB0DZZB8B8BxBCBKBBO+C+CBBBEBBCrFrFBBBgBBB7BBBCDBDBBDCBKLLB1C1CBBBIDDCDBCBBCmDmDBBBJBBErDrDBBBHCCBCBDuHuHBBBHDBDyDyDBBBJBBCuDuDCBBHoDoDCBBFmImIBBBK4H4HBEBCBBFDDCvEvEBBBJDBF1C1CeBB-BqGqGECCoGPPrDIID2G2GBDBFBBC-K-KBNNxBBBJBBCpvQpvQBBBlxD2BBpDBB0rYBBHFB",!1)),Me:()=>new p(g("okBBB1xF-wB-wBBCBCCBsshBCB",!1)),Mn:()=>new p(g("gYvDB0IEBqIsBBCCCBCCBCCpCKBxBUBRmDmDBFBDFBDBBCDBkBffBZB8CKB7BIBKZZBCBCIBCCBCEBsBCB8BIBrBXBCfB4BCCFHBFEEBFBLBBe7B7BFDBJVVBbbDBB6BFFBFFBDDBBBEffBEEMBB6BFFBDBCBBFVVBXXBEBC7B7BDCCBCBJIIBMMBff+BNNzBEE4BCCBBBGCBCDBIBBMBBe7B7BDHHGBBVBBdBB6BBBFDBJVVBeepCIIBBBC7C7CDGBNHBjDDDBHBMGBqCBBcEC4BNBCEBCBBGKBCjBBKnDnDBCBCFBCBBDBBaBBFCBRDBODDBHHQgWgWBBBzdCBeBBfBBfBBhCBBCGBJDDBJBKuBuBBBBC2D2DBjBjB3DCBFBBKHHBBB8GBBD7B7BCGBCCCDHBHJBDxBxBBMBCeBDLBVDBxBCCBDBCGGpBIBNBBhBDBDBBCCB5BCCBEECCB7BHBDBB5ECBCMBCGBFHHEBBnG-BBxWMBFEEBKB--CCBuEhDhDBeBrRDBsDBB1udFFBIBhBBBxCBBxIEEFaaBGG4EBBbRBOnBnBBGBaKBvBCBxBDDBCBDBBoBkCkCBEBDBBDBBNJJwB0B0BCCBDBBGBBCrBrBBJJvHDDFx5Tx5TiXPBRPBuejHjH2EEBn0BCBCBBGDBpBCBFmFmFB+R+RBCBiCEB+JBBuCFBnCKByBDB8D3B3BBNBqBDDBLLBBByBDBDBBI+B+BBBBlBEBCHB-BNNB1B1BBHBLDBDgDgDBBBDCCBHHD+E+EEHBWBB6BBBEmBmBBFBEEBnCFBOECPBB2CHBDCBCYY1CFBCFFBCCBvHvHBCBHBBCBBcBB2CHBDCCBrDrDCDDBEBCmDmDCDDBCBCEBkIIBCBBhIBBCFFxEDBDBBFhBhBBIBpBFBDDBJKKBEBDCBvBMBCBBnGCCBBBCqGqGBFBCFBCzCzCBUBDGBCBBCBB7DFBECCBCCBFBCpCpCBEEC8K8KBMMB1B1BBDBGCCYmnFmnFHOBpmLLBECBhuCEB8BGB5gBgCgCBCByC5lT5lTBizEizEBsBBDWBhRCBSHBDGBfDB1ECB89B2BBFxBBJPPXEBCOBxqBGBCQBDGBCBBCEBlDhFhFBFB4L+B+BBCB9PDB-HBB0HDDIBBG7O7OBFBuDGB29lYvHB",!1)),N:()=>new p(g("wBJB5DBBGDDBBBitBJBnEJBnGJB9MJB3DJBFFBtDJB3DJB3DJBDFBvDMB0DJBJGBoDJBpDGBISBuDJBhDJB3DJBnCTBtIJBnCJBwWTBybCBwHJBHJBXJBtJJBhEKBmFJBHJB3FJB3CJBnEJBHJB3gBEEBEBHJBnGyBBDEB3W7BBvCVB3TdBqrBqYqYaIBPCB4KDBrEJBfHBCOBhBJBoBOBh7cJB9FJBhKFB7EJBnBJBnGJBXJB3CJB3MJB34UJBuPsBBN4BBSBB2KaBlBDBeJJnEEBrGJBvdHBaGBoBIBsCEBXFBhFBBDPBDtBBhCIB1BBBfCBsCEBpDHBZHBqBGBrKFBxBJBHJB3IeB-EJBrBDBxDGBnEdBhEJB9BJBxEJBITB8HJB3KJB3DJB3LJBnDJBHTBtCLBlNSB+CJB3UJB3CcBkHJBnCJB3BJBnLJBnDUBshBuDBimPJBnpCJB3CJBnEJBCGBvQJBnIWB+KCB6nXJBnuBTBNTBtDYB2iBxBBhqCJBnNJB3PJB4HJBtWIBhEJB4Y6BBCCBCDBtCsBBCOBjeMBk3CJB",!1)),Nd:()=>new p(g("wBJnxBJnEJnGJ9MJ3DJ3DJ3DJ3DJ3DJ3DJ3DJ3DJ3DJhDJ3DJnCJ3IJnCJn6BJnBJtJJhEJnFJHJ3FJ3CJnEJHJnuiBJnVJnBJnGJXJ3CJ3MJ34UJnsBJnkCJHJ9YJhEJ9BJxEJ3IJ3KJ3DJ3LJnDJHTtCJnNJnDJ3UJ3CJ3HJnCJ3BJnLJ3uQJnpCJ3CJnEJ3QJ37XJ12CxBhqCJnNJ3PJ4HJ2aJ30EJ",!0)),Nl:()=>new p(g("u3FCBwzCiBBDDB-zDaaBHBPCBs1dJBxyW0BBtOJJnEEBrhIuDBm8SCB",!1)),No:()=>new p(g("yFBBGDDBBB2pCFB5LFB5DCBmEGB6GGBSIByNJB2hBTB0jBJBhP20B20BEFBHJBnGPBqB3W3WB6BBvCVB3TdBqrB1kB1kBBCBrEJBfHBCOBhBJBoBOBxrdFBymWsBBiCDBSBB2KaBlBDB1pBHBaGBoBIBsCEBXFBhFBBDPBDtBBhCIB1BBBfCBsCEBpDHBZHBqBGBrKFBhLeB-EJBrBDBxDGBnETB8LTBmqBBBvNIBobSB0aUBn8SGB-YWBqhZTBNTBtDYBvqFIBid6BBCCBCDBtCsBBCOBjeMB",!1)),P:()=>new p(g("hBCBCFBCDBLBBEBBbCBCccCkBkBGEELBBEEE-VJJzOFBqBBB0BCCDDDtBBBVBBCBBOCCBBBrCDBnDsBsBBMBqHCB3BOBgBmImIBLLtE5D5D6DnMnMNwLwL7CLLBpFpFBNBCmBmBBCBoCrCrCBDBFBBwDFBsFlTlTBHB4EuTuTtBBBvCCBoCBB+ECBCCBmBKB6JBB5GBBhEGBCFBhFBBLGBdCB9DDB8BEB-BBBhCHBM9Z9ZBWBJTBCMBCLBfBBPBB6TDBeBB+hBNBwCBBgBJB0MVBgCDBhBBB8XDBCBBxDwEwEBtBBCfBDLBkNCBFJBDLBRNNjD7C7CjgdBBuICBkDLL0DFB9LDB3CBBpBCBCyByBBwBwBiDMBRBB9DDB-DBBRBB6HzqUzqUBxGxGBIBXiBBCNBCFFCBB2ECBCFBCDBLBBEBBbCBCccCCCBFB7MCB9UxBxB-MoXoXoGgBgBxIIBnBxDxDBFBjCGB6CDByO-J-JjBlElEBDBtBDB+FGBuDBBCDB-DDBxBBBwCDBFOOCCB5CFBsDrJrJBCCBzDzDBDBLBBCpDpD7HWBqDCBdMBtCjEjEBBB9HpIpIBBB8E9C9CBGB0CCBCEB+CJB4GgDgDBDBrBBBmUBBrCMBwFxjBxjBBDB97CBB8zOBBmEiCiCBDBJpRpRBBBoJDBoK9lT9lTovHEB07C-a-aBAB",!1)),Pc:()=>new p(g("-Cg-Hg-HBUU-u3BBBZCBwHAB",!1)),Pd:()=>new p(g("tB9qB9qB0BiyDiyDmgBqgCqgCBEBiwDDDgBBBFdd-NUUwDxszBxszBBmBmBLqFqFhzD-J-J",!1)),Pe:()=>new p(g("pB0B0BgB+1D+1DC-6B-6BqtC4B4BQ7T7TCff-hBMCxChBhBCGC1MUChCCCiBmhBmhBCECtBGCtNICEGCDBB-ozB6G6GeOCESSCCCrF0B0BgBGD",!1)),Pf:()=>new p(g("7F+6H+6HEddpuDCCFDDQEE",!1)),Pi:()=>new p(g("rFt7Ht7HDBBDaapuDCCFDDQEE",!1)),Po:()=>new p(g("hBCBCCBDECBLLBEEBcclCGGPBBI-V-VJzOzOBEBqB3B3BDDDtBBBVBBCBBOCCBBBrCDBnDsBsBBMBqHCB3BOBgBmImIBLLtE5D5D6DnMnMNwLwL7CLLBpFpFBNBCxDxDrCEBFBBwDFBsFlTlTBHBmY9D9DBBBoCBB+ECBCCBmBFBCDB6JBB5GBBhEGBCFBhFBBLGBdCB9DDB8BEB-BBBhCHBMjajaBJJBGBJIBDDBDCBEKBCCCBIB7kDDBCBBxDwEwEBFFBBBDDDBHBCBBCDDBLLBDBCJBDDBCCCBLBDCBtNCB6B+F+FjgdBBuICBkDLL0DFB9LDB3CBBpBCBCyByBBwBwBiDMBRBB9DDB-DBBRBB6HlxUlxUBFBDXXVBBDDBECBCDBICBHCCB2E2EBBBCCBDECBLLBEEBcclBDDB7M7MBBB9UxBxB-MoXoXoGgBgBxIIBnBxDxDBFBjCGB6CDB0ZlElEBDBtBDB+FGBuDBBCDB-DDBxBBBwCDBFOOCCB5CFBsDrJrJBCCBzDzDBDBLBBCpDpD7HWBqDCBdMBtCjEjEBBB9HpIpIBBB8E9C9CBGB0CCBCEB+CJB4GgDgDBDBrBBBmUBBrCMBwFxjBxjBBDB97CBB8zOBBmEiCiCBDBJpRpRBBBoJDBoK9lT9lTovHEB07C-a-aBAB",!1)),Ps:()=>new p(g("oBzBzBgB-1D-1DC-6B-6B-rCEEnB4B4BQ7T7TCff-hBMCxChBhBCGC1MUChCCCiBmhBmhBCECaTTCECtNICEGCDipzBipzB4GeeCMCESSCCCrFzBzBgBEEDAB",!1)),S:()=>new p(g("kBHHRCBgBCCcCCkBEBCBBDCCBCBDEEfgBgBrODBNNBGGBCCCBPB2DPPBxDxDsErIrIBBB3DCBDDDBvGvGLUUB4H4HIBBpEqLqLBHHB2H2H-DjEjEBGBlEwGwGqBmGmGiGCBQCCBBBDFBVECmEHBCFBCBBGDBmGBBxXJB0WuLuLlL+E+EBgBBiLJBKIBhiBCCBBBMCBOCBOCBOBBmCOOoBCBOCBUhBB-BBBCDBCBBLCCBBBGFBCECFMMBFFBDBGDBC7B7BBFFB2LBFcBD+HBXKByCtCBXnTBtBwBBDeBLyMBX+BBFfBD1LBDpEBmHFBmLBBvBZBC4CBN1GBbPBFOOBNNWBBHBB8CBB0HBBFJBhBlBBKRRBdBMdBJQQBeBLmBBQ-JBhuG-BBx0V2BB6RWBKBBoDBB+EDBLDB+RCBiHPPB+9T+9TpEgBBuLPBhCBB3BHBtBDBjDCCBBBD7E7EHRRBBBgBCCcCCiEGBCGBOBB6JIB6BQBDCBCMBEwBwBBrBB7zBBBwSmWmWBiKiKBGBnjC2kC2kCBbBr6SDBG3qU3qUk7DvHBLCBEzNBHWBQQBgDzDB9B1HBLmBBD7BBGCBXBBIdBF8BBWhCBE7F7FB1CBrbaagBaagBaagBaagBaa9B-PB4BDBzBHBCNBCBBp2BwNwNttCEE+DiOiOBvIvIBqBBFjDBNOBDOBCOBCkBBYgFB5BcBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBC7CBLAB",!1)),Sc:()=>new p(g("kB+D+DBCBqnB8D8DzPBBzPBBI2H2HoImSmS8sClmClmCBgBB37hBkuVkuVtD7E7E8GBBEBB3-HDB-4wBxtCxtC",!1)),Sk:()=>new p(g("+CCCoCHHFEEqQDBNNBGGBCCCBPB2DPPBjoBjoB15FCCBBBMCBOCBOCBOBB9kEBBkzdWBKBBoDBBxePPBniUniUBPB8bCCjF4g9B4g9BBDB",!1)),Sm:()=>new p(g("rBRRBBB+BCCuBFFmBgBgB-XwQwQBBB8xGOOoBCBOCBsEoBoBBDBHlClCBDBGBBFGDIgBgBBDDCgBgBBqIBhBBB7CffBXBpBFB2OKK3BHBwDxKxKBDBDeBLPBhIiEBX+BBFfBDhIBxBUBDFB9+zB5Z5ZCCBlFRRBBB+BCCkEHHBCBitDBBhrwBx+Bx+BagBgBagBgBagBgBagBgBat5Ft5FB-uC-uCBHB",!1)),So:()=>new p(g("mFDDFCCyerIrIBgEgEBvGvGLUUB4H4HkQ2L2LjEFBClElEwGqBqBoMCBQCCBBBDFBVECmEHBCFBCBBGDBmGBBxXJB0WzWzW+EhBBiLJBKIBksBBBCDBCBBLCCBHHBEBCECFMMBPPCBBC7B7BBKKBDBDDBCBBCBBCGBCeBDBBCCCBdBtIHBFTBDGBDwCBCdBanBBHnCBXKByCtCBX2FBCIBC1BBJuDBC3HBtBrBBhC-HBhQvBBWBBHmBBDpEBmHFBmLBBvBZBC4CBN1GBbPBFOOBNNWBBHBBxKBBFJBhBlBBKRRBdBMdBJQQBeBLmBBQ-JBhuG-BBx0V2BBibDBLBBC+R+RBBBqqUPBuLPBhCBB3BHBuBCBlPEEFBBOBB6JIB6BQBDCBCMBEwBwBBrBB7zBBBwSpgBpgBBGBnjC2kC2kCBGBFQBr6SDBG3qU3qUk7DvHBLCBEzNBHWBQPBhDzDB9B1HBLmBBD7BBGCBXBBIdBF8BBWhCBE7F7FB1CBqlB-PB4BDBzBHBCNBCBBp2B96C96CiEyWyWBqBBFjDBNOBDOBCOBCkBBYgFB5BcBOrBBFIBIBBPFB7E6HBG4WBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBB-B3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBC7CBLAB",!1)),Z:()=>new p(g("gBgEgEgvFgsCgsCBJBeBBGwBwBh9DAB",!1)),Zl:()=>new p(g("ohIA",!0)),Zp:()=>new p(g("phIA",!0)),Zs:()=>new p(g("gBgEgEgvFgsCgsCBJBlBwBwBh9DAB",!1)),ASCII_Hex_Digit:()=>new p(g("wBJIFbF",!0)),Alphabetic:()=>new p(g("hCZBHZBwBLLFGGBVBCeBCpOBFLBPEBICC3CeeBQBCBBDDBCHHCCBCCCBSBCyCBCqEBJlFBClBBDHHBnBBoBNBCCCBCCBCCJaBFDBeKBG3BBCGBPlDBCHBFHBFCBLCBDRRBuBBOkDBZgBBKBBFGGBWBDSBUYBIKBGXBCGBIJJBoBBLLBEGBHrCBCPBCCBFOBOSBCHBDBBDVBCGBCEEBCBEHBDBBDBBCJJFBBCEBNBBLFFBBBCFBFBBDVBCGBCBBCBBCBBFEBFBBDBBFIIBCBCSSBEBMCBCIBCCBCVBCGBCBBCEBEIBCCBCBBEQQBCBWDBFCBCHBDBBDVBCGBCBBCEBEHBDBBDBBKBBFBBCEBORRBCCBEBECBCDBEBBCCCBEEBEEBBBELBFEBECBCCBEHHpBMBCCBCWBCPBEHBCCBCCBJBBCCBCBBDDBdDBCHBCCBCWBCJBCEBEHBCCBCCBJBBGCBCDBOCBNMBCCBCoBBDHBCCBCCBCGGBCBIEBXFBCCBCRBEXBCIBCDDBFBJFBCCCBGBTBBO5BBGGBH0B0BBECBDBCXBCCCBRBCCBDEBCHHPDBhBgCgCBGBCjBBFSBFPBCjBBkC2BBCDDBDBR-BBLDBDlBBCGGDqBBCsKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPBR1CBDFBErTBDQBCZBGqCBEKBITBMUBNTBNMBCCBCBBNzBBDSBPFFkC4CBIqBBGlCBLeBCLBFIBYdBDEBMrBBFZB3BbBF+BBDTBzBYYBMMBBByBzBBCOBCHB0BpBBDDBLrBBCKBP2BBXCBLjBBDKBGqBBDCBqBDBCFBCBBEGGB+FBUhBBM1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGB1DOORMBmDFFDJBCEEBDBHGCBCBCKBDDBGEBFSSBnBBuZzBB34BkHBHDBEBBNlBBCGGD3BBIRRBVBKGBCGBCGBCGBCGBCGBCGBCGBCfBwB2O2OBBBaIBIEBDEBF1CBHCBC5CBCDBGqBBC9CBSfBxBPBhQ-tGBhCs0VBkCtBBDsIBEPBLBBVuBBGHBEwDBoBIBDmDBDxCBVUBCgBBZzBBNjCBCtBtBBEBECCBBBLgBBGiBBOcBEyBBCLBQRRBOBLEBC2BBKNBTWBEkCBCCCZCBDPBDDBMFBDFBDFBKGBCGBCqBBCNBH6DBWj9KBNWBFwBBloItLBDpDBnBGBNEBGLBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBlBZBHZBM4CBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmC0BBsIcBEwBBwBfBOdBGqBBGdBDjBBFHBCEBrB9EBTjBBFjBBFnBBJzBBNKBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCDBCBBGHBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4ByBBOyBBOnBBjBbBEGGBVB7HpBBCBBEBBRFBzBCBEcBLJJBUBrBRBvBUBcWBKlCBsBEBL4BBKOOBXBYyBBSDBJiBBEKKB+BBCDBKBBLCCkBRBChBBDHHBCB-BGBCCCBCBCOBCJBI4BBYDBCHBDBBDVBCGBCBBCEBEHBDBBDBBEHHGGBdJBCDDClBBCJBCDDCDBCBBECCtBhCBCCBCDBVCBfhCBDBBC5F5FB0BBDGBaFBjB+BBCEE8B1BBDoCoCBZBDNBWGB6F4BBoD-BBgBHBDDDBGBCBBCdBCBBDBBDDB+CHBDtBBDFBCCCBccBxBBDJBSnCBGTTBnCBoDHB5CgBBgBIBCsBBCGBCyByBBcBDVBCNBqCGBCBBCrBBECCBCCBBBCDDBZZBEBCBBCkBBCBBCDBCYYBqBBlIWBKQBCoBBECBwDwCwCB4cBnDuDBSjGBtyCgDBQvhBBSFBa68DBGmSB61GuBBy2B4RBIeBSuCBSdBTvBBRDBgBUBGSBxNsBB0G-BBhBYBDYBtBqCBF4BBIQBhCBBCNNBFBK1mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBFi7Fi7FBzCBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BeBHFB2GGBCQBDGBCBBCEBG9BBiBxDxDBrBBLGBRiKiKBcBTrBBlPbBlHdBDwGwGBdBCVBJBBhHGBCDBCBBCOBCkGB8BjCBEEE1lBDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1TZBHZBHZB3zD-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB",!1)),Dash:()=>new p(g("tB9qB9qB0BiyDiyDmgBqgCqgCBEB+BoBoBQnMnMlgDDDgBBBFdd-NUUwDxszBxszBBmBmBLqFqFhzD-J-J",!1)),Emoji:()=>new p(g("jBHHGJBwDFFu8HNN5GXX7CFBQBBwLBBNnFnFaKBFCBoGoHoHBLLK7B7BBCBCEBKGDBDDFDDCBBDIEBJJBBBGCCGLBMBBDCCBCCTDDBTTBEBCCCBEEBGGDBBFBBMBBGBBDGGBECBVVBGGBEBCDBDFFDDDBEBCDDCCCHEEHLLBQQDFFCFFBBBCMMBxBxBBBBKeP1LBBwOCBUBB0BFF7mBNN6SCCrrvDrGrGhFBBNBBPDDBIBsCZBCBBYVVDIBWBBvFhBBDvDBDBBCCBDyCBDCBCmIBC+BBMFBCXBIBBDHBNDDBCBDFFBOOBDDJBBKGGBBBNCBJCBDCCFHHEHHB0CBxBlCBGHBDDBEJBECCBEEDJBkHLBF8I8IBtBBCJBC4FBxDMBEKBE4BBCFFBOBDLBFJB",!1)),Emoji_Component:()=>new p(g("jBHHGJB0+H2G2Gsp3B3+8B3+8BBYB8PEBxtBDBtzhY-CB",!1)),Emoji_Modifier:()=>new p(g("7-8DE",!0)),Emoji_Modifier_Base:()=>new p(g("9wJ8G8GRDB4jzD9B9BBBBDDDBBB2DBBDKBWSBEFFBBBCCBICCZqGqGBFFWFFBvFvFBBBEEB0CRRBBBKMMgSDDJHBHKKBIBDCB5B+B+BBCCBCCSCBCMBmHCBrBIB",!1)),Emoji_Presentation:()=>new p(g("64IBBuGDBEDDqQBBWBBzBLBsBUUOJJBSSBGGBJJGWWIBBCFFDIIFBBdkBkBCFFBBBC+B+BBBBZPP8aBB0BFFvlxDrGrG-FDDBIBsCZBCZZVDDBDBCCBWBBvFgBBNIBClCBCVBNqBBFEBNQBEEEBlCBCCCB5FBD+BBODBCXBTbbBOO3C0CBxBlCBHEEBBBDDBEDBMBBIIBkHLBF8I8IBtBBCJBC4FBxDMBEKBE4BBCFFBOBDLBFJB",!1)),Extended_Pictographic:()=>new p(g("pFFFu8HNN5GXX7CFBQBBwLBBNnFnFaKBFCBoGoHoHBLLK7B7BBCBCEBKGDBDDFDDCBBDIEBJJBBBGCCGLBMBBDCCBCCTDDBTTBEBCCCBEEBGGDBBFBBMBBGBBDGGBECBVVBGGBEBCDBDFFDDDBEBCDDCCCHEEHLLBQQDFFCFFBBBCMMBxBxBBBBKeP1LBBwOCBUBB0BFF7mBNN6SCCrrvDoBoBBCBlDLBQBBQPPBmBmBBIBxDBBNBBPDDBIBU3BBcOBLVVDIBCDBKWBH7FBDvDBDBBCCBDyCBDCBCDBG9HBC+BBMFBCXBIBBDHBNDDBCBDFFBOOBDDJBBKGGBBBNCBJCBDCCFHHEHHB0CBxBlCBGHBDQBECCBEBDMB7GlBBNDB5BHBLFBpBHBfBBNDBDNBKmBBNuBBCJBC4FB5CHBPxEBhI9fB",!1)),Hex_Digit:()=>new p(g("wBJIFbFq1-BJIFbF",!0)),Lowercase:()=>new p(g("hDZBwBLLFlBlBBWBCHBC2BCBQCBuBCDECBBBDCCDEEBFFDEEBBBDDDCCCDCCBCCDEECDDBDDBBBHGDCOCBSCBDDCEEC4BCBFBDDDBCCFICBjCBDiBBIBBfEBhDsBsBCEEDDBTccBhBBCBBECBCWCBDBCGDB0B0BBuBBCgBCK0BCDMCBgDCxBoBBo6CqBBCDB5XFBjkCIBC2D2DB+FBiC0ECBHBCgDCBHBJFBLHBJHBJFBLHBJHBJNBDHBJHBJHBJEBCBBHEEBBBCBBJDBDBBJHBLCBCBB6DOORMBuDEEBEEcKFDBBJDBFiBiBBOBFsasaBYBn6BvBBCEEBGCFCCBCCBGBEiDCBIICFFNlBBCGG0oesBCUaCBBBmEMCBBBC8BCBIBCCCDICFCCDCCBBBCSCGGGCMCFCCDOCWDBCCCBBB2ZqBBCNBHvCBh6TGBNEBqhBZBumBnBBpEjBB8EKBCOBCGBCBBkODDBBBCpBBCIBmoByBB+DVB75CfBhsVfB8BYBnqZZBbGBCRBbZBbDBCCCBFBCKBbZBbZBbZBbZBbZBbZBbZBbZBbbBdYBCFBbYBCFBbYBCFBbYBCFBbYBCFBC15B15BBIBCTBHFBmI9BB1lChBB",!1)),Math:()=>new p(g("rBRRBBBgBeeCuBuBFmBmBgB5W5WBBBDbbBDDBBBwQCBuwGccBBBMEEOPPBCBWEBMEBiCMBFEEBFFBDBTFFDJBCDDBEBHEEBDDBCCBBBCFBENBClClCBWBCFBCBBFBBFfBCHHBPPBqIBJDBVBB7CffBZBCZZMGB+NBBNJBFFBFBBDBBEEBPCCDFBMHBGBB6BCCeDBKCBxK-BBhI-PBxBUBDFB9+zB4Z4ZBEBCjFjFRCBeCCeCCkEHHBCBitDBBhrwBwoBwoBBzCBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBDxBBhwFDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBB-uCIB",!1)),Quotation_Mark:()=>new p(g("iBFFkEQQ96HHBaBBowDqOqOBCBOCBixzBDB+FFF7CBB",!1)),Terminal_Punctuation:()=>new p(g("hBLLCMMBEE-ZJJiQ6B6BpCPPCCB1FsBsBBJBCsHsHB3B3BBEBCHBgBmImIB1nB1nBBtFtFFFB4JBB2YHBmY9D9DBBBoCBB+ECBEoBoBBCBDBB7JBBjLDBjFBBLBBCCBeCB8FEB-BBBldYYBKKBBBwlDCBzJOOFLLCBBEBBtNBB8ndBBuICBkHEB-LBB3CBBgD4E4EBBB0ECBgERRB6H6HnxUDDB6B6BBBBCDBqFLLCMMBEEiCDD7hBxBxBnkBoGoG3JBB5EFBlCFB6CDB5dEBtBDB+FGBxDDBgECBiEBBHRRB5C5CBDBtDrJrJB2D2DBBBNBBnLDBEOBqDBB6HCBmQCC8HBB4CBBFBB-MCBuBmUmUBrCrCBspBspBBDB6vRBBmEiCiCBBBLqRqRBoJoJBnwTnwTovHDB",!1)),Uppercase:()=>new p(g("hCZBmDWBCGBiB2BCDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIJDCMCDQCDDDCCBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBDDBBBEWCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBpCDBNDBNDBNEBMDBnIFFECBDCBDEEBDBHGCBCBDDBLBBGbbBOBUzZzZBYBx5BvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoqZZBbZBbZBbCCBGDBDDBCBCHBbZBbBBCDBDHBCGBcBBCDBCEBCEEBFBcZBbZBbZBbZBbZBbZBfYBiBYBiBYBiBYBiBYBiB2pE2pEBgBBvgCZBHZBHZB",!1)),White_Space:()=>new p(g("JEBTlDlDbgvFgvFgsCKBeBBGwBwBh9DAB",!1))});static get Upper(){return this.CATEGORIES.get("Lu")}static SCRIPTS=new Ei({Adlam:()=>new p(g("go6DrCFJFB",!0)),Ahom:()=>new p(g("g4lCaDOFW",!0)),Anatolian_Hieroglyphs:()=>new p(g("ggxCmS",!0)),Arabic:()=>new p(g("gwBEBCFBCNBCCBCfBCJBMZBCrDBChBBxCvBBxHhBBGqCBCcBxy8BtPBDvEBhBPBxDEBCmEBk7DeBkCFBJIBiBFBh43BDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBB",!1)),Armenian:()=>new p(g("xpBlBDxBDCks9BE",!0)),Avestan:()=>new p(g("g4iC1BEG",!0)),Balinese:()=>new p(g("g4GsCCxB",!0)),Bamum:()=>new p(g("g1pB3CpowB4R",!0)),Bassa_Vah:()=>new p(g("w26CdDF",!0)),Batak:()=>new p(g("g+GzBJD",!0)),Bengali:()=>new p(g("gsCDBCHBDBBDVBCGBCEEBCBDIBDBBDDBJFFBCCBDBDYB",!1)),Beria_Erfe:()=>new p(g("g17CYDY",!0)),Bhaiksuki:()=>new p(g("ggnCICsBCNLc",!0)),Bopomofo:()=>new p(g("qXB6wLqBxDf",!0)),Brahmi:()=>new p(g("ggkCtCFjBKA",!0)),Braille:()=>new p(g("ggK-H",!0)),Buginese:()=>new p(g("gwGbDB",!0)),Buhid:()=>new p(g("g6FT",!0)),Canadian_Aboriginal:()=>new p(g("ggF-TxRlC7tgCP",!0)),Carian:()=>new p(g("g1gCwB",!0)),Caucasian_Albanian:()=>new p(g("wphCzBMA",!0)),Chakma:()=>new p(g("gokC0BCR",!0)),Cham:()=>new p(g("gwqB2BKNDJDD",!0)),Cherokee:()=>new p(g("g9E1CDFz7lBvC",!0)),Chorasmian:()=>new p(g("w9jCb",!0)),Common:()=>new p(g("AgCBbFBbuBBCOBCEBYgBgBiOmBBGEBDTB1DKKHCC+THHPEEhB9E9ElQiEiEB6mB6mB2MDBjJwvBwvBBBBoCBBsGBBCumBumBOIIBCBCFBCCBDmYmYBKBD2CBCKBEKBCOBShBB-BlBBCCBDFBCaBCQBqBCBF5UBXKBW-cBhIzTBDpEBhQ9CBzMUBCCCBXBQHBFDB8CBBE7C7CB0E0EBOBhBlBBKxBxBB+BBgBwCBwB5C5CBmFBhuG-BBhoWhBBnDCBmFJB1HhFhFsMPPBzuUzuUBxGxGBIBXiBBCSBCDB0ECCBeBbFBbKBLuBuBBhChCBFBCGBLEBjICBFsBBEIBxCMB0BsBBlHaBltuBDB96D8HBEzNBHWBQQBgDzDB9B1HBLmBBD9BBEQBJBBIdBF8BB2GTBNTBN2CBKYBoE0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBDxBByjFjCBtC8BBjWrBBFjDBNOBDOBCOBCkBBLtFB5BZBCBBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBCmDBnghYffB+CB",!1)),Coptic:()=>new p(g("ifNxkKzDGG",!0)),Cuneiform:()=>new p(g("ggoC5cnDuDCEMjG",!0)),Cypriot:()=>new p(g("ggiCFBDCCBqBBCBBEDD",!1)),Cypro_Minoan:()=>new p(g("w8rCiD",!0)),Cyrillic:()=>new p(g("ggBkEBDoFBx6FKBhFtCtCojEfBhie-CBv8VBBhw4B9BBiBAB",!1)),Deseret:()=>new p(g("gghCvC",!0)),Devanagari:()=>new p(g("goCwCFODZh7nBfhwcJ",!0)),Dives_Akuru:()=>new p(g("gomCGBDDDBGBCBBCdBCBBDLBKJB",!1)),Dogra:()=>new p(g("ggmC7B",!0)),Duployan:()=>new p(g("ggvDqDGMEIIJDD",!0)),Egyptian_Hieroglyphs:()=>new p(g("ggsC1iBL68D",!0)),Elbasan:()=>new p(g("gohCnB",!0)),Elymaic:()=>new p(g("g-jCW",!0)),Ethiopic:()=>new p(g("gwEoCBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBDfBEZBnvGWBKGBCGBCGBCGBCGBCGBCGBCGBjpfFBDFBDFBKGBCGBylvCGBCDBCBBCOB",!1)),Garay:()=>new p(g("gqjClBEcJB",!0)),Georgian:()=>new p(g("glElBBCGGDqBBCDBx8CqBBDCBhiElBBCGG",!1)),Glagolitic:()=>new p(g("ggL-Ch9sDGCQDGCBCE",!0)),Gothic:()=>new p(g("w5gCa",!0)),Grantha:()=>new p(g("g4kCDBCHBDBBDVBCGBCBBCEBDIBDBBDCBDHHGGBDGBEEB",!1)),Greek:()=>new p(g("wbDBCCBDDBCFFCCCBBBCCCBSBC+BBPPBnpGEBzBEBFEB1ChKhKBUBDFBDlBBDFBDHBCGCBdBD0BBCOBCNBDFBCSBDCBCIBoJ-xiB-xiB7uVuCBSgj0Bgj0BBkCB",!1)),Gujarati:()=>new p(g("h0CCBCIBCCBCVBCGBCBBCEBDJBCCBCCBDQQBCBDLBIGB",!1)),Gunjala_Gondi:()=>new p(g("grnCFCBCkBCBCFIJ",!0)),Gurmukhi:()=>new p(g("hwCCBCFBFBBDVBCGBCBBCBBCBBDCCBDBFBBDCBEIIBCBCIIBPB",!1)),Gurung_Khema:()=>new p(g("go4C5B",!0)),Han:()=>new p(g("g0LZBC4CBN1GBwBCCaIBPDBle-tGBhC-vUBhoWtLBDpDBpodBBNGBqgkB-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB",!1)),Hangul:()=>new p(g("goE-HvxHBiI9CyDeiCei3dckUj9KNWFwBl9JeEFDFDFDC",!0)),Hanifi_Rohingya:()=>new p(g("gojCnBJJ",!0)),Hanunoo:()=>new p(g("g5FU",!0)),Hatran:()=>new p(g("gniCSCBGE",!0)),Hebrew:()=>new p(g("xsB2BBJaBFFBpp9BZBCEBCCCBCCBCCBIB",!1)),Hiragana:()=>new p(g("hiM1CBHCBi7-C+IBTeeBBBulQAB",!1)),Imperial_Aramaic:()=>new p(g("giiCVCI",!0)),Inherited:()=>new p(g("gYvDB2IBBlOKBbhXhXBCB8qEtBBDLBlPCBCMBCGBFHHEBBnG-BBtQBBjGgBB65DDBsDBBmrzBPBRNBwejHjH7iEl+uBl+uBBsBBDWBhRCBSHBDGBfDBz6rYvHB",!1)),Inscriptional_Pahlavi:()=>new p(g("g7iCSGH",!0)),Inscriptional_Parthian:()=>new p(g("g6iCVDH",!0)),Javanese:()=>new p(g("gsqBtCDJFB",!0)),Kaithi:()=>new p(g("gkkCiCLA",!0)),Kannada:()=>new p(g("gkDMCCCWCJCEDICCCDIBGCCDDJCC",!0)),Katakana:()=>new p(g("hlM5CBDCBxHPBxGuBBC3CBvgzBJBCsBBzisBDBCGBCBBCgJgJBBBzBPPBCB",!1)),Kawi:()=>new p(g("g4nCQCoBEc",!0)),Kayah_Li:()=>new p(g("goqBtBCA",!0)),Kharoshthi:()=>new p(g("gwiCDCBGHCCCcDCFJII",!0)),Khitan_Small_Script:()=>new p(g("k-7C84G84GB0OBqBAB",!1)),Khmer:()=>new p(g("g8F9CDJHJnPf",!0)),Khojki:()=>new p(g("gwkCRCuB",!0)),Khudawadi:()=>new p(g("w1kC6BGJ",!0)),Kirat_Rai:()=>new p(g("gq7C5B",!0)),Lao:()=>new p(g("h0DBBCCCBDBCXBCCCBVBDEBCCCBFBCJBDDB",!1)),Latin:()=>new p(g("hCZBHZBwBQQGWBCeBCgOBoBEB8wGlBBHwBBGDBGMBClCBiC-HByLOORMBuEBBHccSoBB42CfBj1elDBExCBVOBxZqBBCIBCDB38TGB7gBZBHZBmhCFBCpBBCIBm61BeBHFB",!1)),Lepcha:()=>new p(g("ggH3BEOEC",!0)),Limbu:()=>new p(g("goGeBCLBFLBFEEBKB",!1)),Linear_A:()=>new p(g("gwhC2JKVLH",!0)),Linear_B:()=>new p(g("gggCLCZCSCBCODNjB6D",!0)),Lisu:()=>new p(g("wmpBvBx1eA",!0)),Lycian:()=>new p(g("g0gCc",!0)),Lydian:()=>new p(g("gpiCZGA",!0)),Mahajani:()=>new p(g("wqkCmB",!0)),Makasar:()=>new p(g("g3nCY",!0)),Malayalam:()=>new p(g("goDMCCCyBCCCFFPDZ",!0)),Mandaic:()=>new p(g("giCbDA",!0)),Manichaean:()=>new p(g("g2iCmBFL",!0)),Marchen:()=>new p(g("wjnCfDVCN",!0)),Masaram_Gondi:()=>new p(g("gonCGBCBBCrBBECCBCCBHBJJB",!1)),Medefaidrin:()=>new p(g("gy7C6C",!0)),Meetei_Mayek:()=>new p(g("g3qBWqGtBDJ",!0)),Mende_Kikakui:()=>new p(g("gg6DkGDP",!0)),Meroitic_Cursive:()=>new p(g("gtiCXFTDtB",!0)),Meroitic_Hieroglyphs:()=>new p(g("gsiCf",!0)),Miao:()=>new p(g("g47CqCF4BIQ",!0)),Modi:()=>new p(g("gwlCkCMJ",!0)),Mongolian:()=>new p(g("ggGBBDCCBSBH4CBIqBB2t-BMB",!1)),Mro:()=>new p(g("gy6CeCJFB",!0)),Multani:()=>new p(g("g0kCGBCCCBCBCOBCKB",!1)),Myanmar:()=>new p(g("ggE-EhqmBeiDfxibT",!0)),Nabataean:()=>new p(g("gkiCeJI",!0)),Nag_Mundari:()=>new p(g("wm5DpB",!0)),Nandinagari:()=>new p(g("gtmCHDtBDK",!0)),New_Tai_Lue:()=>new p(g("gsGrBFZHKEB",!0)),Newa:()=>new p(g("gglC7CCE",!0)),Nko:()=>new p(g("g+B6BDC",!0)),Nushu:()=>new p(g("h-7CvsQvsQBqMB",!1)),Nyiakeng_Puachue_Hmong:()=>new p(g("go4DsBENDJFB",!0)),Ogham:()=>new p(g("g0Fc",!0)),Ol_Chiki:()=>new p(g("wiHvB",!0)),Ol_Onal:()=>new p(g("wu5DqBFA",!0)),Old_Hungarian:()=>new p(g("gkjCyBOyBIF",!0)),Old_Italic:()=>new p(g("g4gCjBKC",!0)),Old_North_Arabian:()=>new p(g("g0iCf",!0)),Old_Permic:()=>new p(g("w6gCqB",!0)),Old_Persian:()=>new p(g("g9gCjBFN",!0)),Old_Sogdian:()=>new p(g("g4jCnB",!0)),Old_South_Arabian:()=>new p(g("gziCf",!0)),Old_Turkic:()=>new p(g("ggjCoC",!0)),Old_Uyghur:()=>new p(g("w7jCZ",!0)),Oriya:()=>new p(g("h4CCCHDBDVCGCBCEDIDBDCICFBCEDR",!0)),Osage:()=>new p(g("wlhCjBFjB",!0)),Osmanya:()=>new p(g("gkhCdDJ",!0)),Pahawh_Hmong:()=>new p(g("g46ClCLJCGCUGS",!0)),Palmyrene:()=>new p(g("gjiCf",!0)),Pau_Cin_Hau:()=>new p(g("g2mC4B",!0)),Phags_Pa:()=>new p(g("giqB3B",!0)),Phoenician:()=>new p(g("goiCbEA",!0)),Psalter_Pahlavi:()=>new p(g("g8iCRIDNG",!0)),Rejang:()=>new p(g("wpqBjBMA",!0)),Runic:()=>new p(g("g1FqCEK",!0)),Samaritan:()=>new p(g("ggCtBDO",!0)),Saurashtra:()=>new p(g("gkqBlCJL",!0)),Sharada:()=>new p(g("gskC-ChsCH",!0)),Shavian:()=>new p(g("wihCvB",!0)),Siddham:()=>new p(g("gslC1BDlB",!0)),Sidetic:()=>new p(g("gqiCZ",!0)),SignWriting:()=>new p(g("gg2DrUQECO",!0)),Sinhala:()=>new p(g("hsDCBCRBEXBCIBCDDBFBEFFBEBCCCBGBHJBDCBt-gCTB",!1)),Sogdian:()=>new p(g("w5jCpB",!0)),Sora_Sompeng:()=>new p(g("wmkCYIJ",!0)),Soyombo:()=>new p(g("wymCyC",!0)),Sundanese:()=>new p(g("g8G-BhIH",!0)),Sunuwar:()=>new p(g("g+mChBPJ",!0)),Syloti_Nagri:()=>new p(g("ggqBsB",!0)),Syriac:()=>new p(g("g4BNC7BDCxIK",!0)),Tagalog:()=>new p(g("g4FVKA",!0)),Tagbanwa:()=>new p(g("g7FMCCCB",!0)),Tai_Le:()=>new p(g("wqGdDE",!0)),Tai_Tham:()=>new p(g("gxG+BCcDKHJHN",!0)),Tai_Viet:()=>new p(g("g0qBiCZE",!0)),Tai_Yo:()=>new p(g("g25DeCVJB",!0)),Takri:()=>new p(g("g0lC5BHJ",!0)),Tamil:()=>new p(g("i8CBBCFBECBCDBEBBCCCBEEBEEBBBELBFEBECBCDBDHHPUBm+kCxBBOAB",!1)),Tangsa:()=>new p(g("wz6CuCCJ",!0)),Tangut:()=>new p(g("g-7CgBgBB+3GBhQeBiDyDB",!1)),Telugu:()=>new p(g("ggDMCCCWCPDICCCDIBCCCBDDDJII",!0)),Thaana:()=>new p(g("g8BxB",!0)),Thai:()=>new p(g("hwD5BGb",!0)),Tibetan:()=>new p(g("g4DnCCjBFmBCjBCOCGFB",!0)),Tifinagh:()=>new p(g("wpL3BIBPA",!0)),Tirhuta:()=>new p(g("gklCnCJJ",!0)),Todhri:()=>new p(g("guhCzB",!0)),Tolong_Siki:()=>new p(g("wtnCrBFJ",!0)),Toto:()=>new p(g("w04De",!0)),Tulu_Tigalari:()=>new p(g("g8kCJBCDDClBBCJBCDDCDBCJBCBBJBB",!1)),Ugaritic:()=>new p(g("g8gCdCA",!0)),Unknown:()=>new p(g("4bBBHDBICCVuMuMnBBBzBBBE4B4BBGBcDBHKBvI9B9BBmDmDBMB8BBByBBBQddBCCMEBjBEBuHJJBDDBXXICCBBBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBbFB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKmDmDNBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBjoIBvLBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCC-FCBHBBHBBHBBECBIIIBIBGBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIBlCJBCBBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMB3iBJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBJ76DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBjGUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIm8yVBCdBhD-DBxHvw-FB",!1)),Vai:()=>new p(g("gopBrJ",!0)),Vithkuqi:()=>new p(g("wrhCKCOCGCBCKCOCGCB",!0)),Wancho:()=>new p(g("g24D5BGA",!0)),Warang_Citi:()=>new p(g("glmCyCNA",!0)),Yezidi:()=>new p(g("g0jCpBCCDB",!0)),Yi:()=>new p(g("ggoBskBE2B",!0)),Zanabazar_Square:()=>new p(g("gwmCnC",!0))});static FOLD_CATEGORIES=new Ei({L:()=>new p(g("laA",!0)),LC:()=>new p(g("laA",!0)),Ll:()=>new p(g("hCZBmDWBCGBiBuBCEECDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIBBCBBCBBCOCDQCDBBCCCBBBC4BCIBBCBBDCCBCBCGC3HrBrBCEEJHHCCBCCCBCCBPBCIBkBJJCUCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBZHBJHBJHBJEBMEBMDBNEBMEBqJEEBHHxC9zC9zCBuBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoyehBB",!1)),Lt:()=>new p(g("kOCCBCCBCClBCCtsHHBJHBJHBMQQwBAB",!1)),Lu:()=>new p(g("hDZB7BqBqBBWBCHBCuBCEECDOCDsBCDECBBBDCCDEEGDDECBDDDCCCDFFDEECDDECCGBBCBBCBBCOCBSCDBBCEECkBCEQCJDDBCCFICBEBCBBCCCBEEBCCBCBCEBDCCBDDIDDCBBEFBGLLBnFnFsBCCEEEBBBvBDBCdBCBBECBCWCBDBCGD1BvBBCgBCK0BCDMCBgDCyBlBBq6CqBBDCB5XFBjkCIBCvHvHERRzD0ECGGGC8CCBHBJFBLHBJHBJFBMGCJHBJNBzBBBNSSBPPBEEpL2B2Bs1CvBBCEEBGCHDDLiDCJCCFNNBkBBCGG0oesBCUaCoEMCE8BCLCCDICFFFCBBDSCMOCFCCDOCb9a9advCBi8UZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBvyehBB",!1)),M:()=>new p(g("5cgBgBlgHAB",!1)),Mn:()=>new p(g("5cgBgBlgHAB",!1)),Emoji:()=>new p(g("8mJA",!0)),Extended_Pictographic:()=>new p(g("8mJA",!0)),Lowercase:()=>new p(g("hCZBmDWBCGBiBuBCEECDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIBBCBBCBBCOCDQCDBBCCCBBBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBJJCUCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBZHBJHBJHBJEBMEBMDBNEBMEBqJEEBHHuBPBUzZzZBYBx5BvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoyehBB",!1)),Math:()=>new p(g("ycGDCHHFMMDDDCHHFAB",!1)),Uppercase:()=>new p(g("hDZB7BqBqBBWBCHBCuBCEECDOCDsBCDECBBBDCCDEEGDDECBDDDCCCDFFDEECDDECCGBBCBBCBBCOCBSCDBBCEECkBCEQCJDDBCCFICBEBCBBCCCBEEBCCBCBCEBDCCBDDIDDCBBEFBGLLBnFnFsBCCEEEBBBvBDBCdBCBBECBCWCBDBCGD1BvBBCgBCK0BCDMCBgDCyBlBBq6CqBBDCB5XFBjkCIBCvHvHERRzD0ECGGGC8CCBHBJFBLHBJHBJFBMGCJHBJNBzBBBNSSBPPBEEpLiBiBBOBFsasaBYBn6BvBBCEEBGCHDDLiDCJCCFNNBkBBCGG0oesBCUaCoEMCE8BCLCCDICFFFCBBDSCMOCFCCDOCb9a9advCBi8UZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBvyehBB",!1))});static FOLD_SCRIPT=new Ei({Common:()=>new p(g("8cgBgB",!1)),Greek:()=>new p(g("1FwUwU",!1)),Inherited:()=>new p(g("5cgBgBlgHAB",!1))})},q=class it{static MAX_RUNE=1114111;static MAX_ASCII=127;static MAX_LATIN1=255;static MAX_BMP=65535;static MIN_FOLD=65;static MAX_FOLD=125251;static MIN_HIGH_SURROGATE=55296;static MAX_HIGH_SURROGATE=56319;static MIN_LOW_SURROGATE=56320;static MAX_LOW_SURROGATE=57343;static MIN_SUPPLEMENTARY_CODE_POINT=65536;static is32(e,t){let n=0,s=e.length;for(;n<s;){let i=n+Math.floor((s-n)/2),a=e.getLo(i),B=e.getHi(i);if(a<=t&&t<=B){let u=e.getStride(i);return(t-a)%u===0}t<a?s=i:n=i+1}return!1}static is(e,t){if(t<=it.MAX_LATIN1){for(let n=0;n<e.length;n++){if(t>e.getHi(n))continue;let s=e.getLo(n);if(t<s)return!1;let i=e.getStride(n);return(t-s)%i===0}return!1}return e.length>0&&t>=e.getLo(0)&&it.is32(e,t)}static isUpper(e){if(e<=it.MAX_LATIN1){let t=String.fromCodePoint(e);return t.toUpperCase()===t&&t.toLowerCase()!==t}return it.is(Qe.Upper,e)}static isPrint(e){return e<=it.MAX_LATIN1?e>=32&&e<it.MAX_ASCII||e>=161&&e!==173:it.is(Qe.Print,e)}static simpleFold(e){if(Qe.CASE_ORBIT.has(e))return Qe.CASE_ORBIT.get(e);let t=F.toLowerCase(e);return t!==e?t:F.toUpperCase(e)}static equalsIgnoreCase(e,t){if(e===t)return!0;if(e<0||t<0)return!1;if(e<=it.MAX_ASCII&&t<=it.MAX_ASCII)return 65<=e&&e<=90&&(e|=32),65<=t&&t<=90&&(t|=32),e===t;for(let n=it.simpleFold(e);n!==e;n=it.simpleFold(n))if(n===t)return!0;return!1}},Ga=256,uf=new Uint8Array(Ga);for(let r=0;r<Ga;r++)uf[r]=97<=r&&r<=122||65<=r&&r<=90||48<=r&&r<=57||r===95?1:0;var Fa=null,xa=null,K=class Ze{static METACHARACTERS="\\.+*?()|[]{}^$";static EMPTY_BEGIN_LINE=1;static EMPTY_END_LINE=2;static EMPTY_BEGIN_TEXT=4;static EMPTY_END_TEXT=8;static EMPTY_WORD_BOUNDARY=16;static EMPTY_NO_WORD_BOUNDARY=32;static EMPTY_ALL=-1;static emptyInts(){return[]}static isByteArray(e){return Array.isArray(e)||e instanceof Uint8Array}static isalnum(e){return F.CODES.get("0")<=e&&e<=F.CODES.get("9")||F.CODES.get("a")<=e&&e<=F.CODES.get("z")||F.CODES.get("A")<=e&&e<=F.CODES.get("Z")}static unhex(e){return F.CODES.get("0")<=e&&e<=F.CODES.get("9")?e-F.CODES.get("0"):F.CODES.get("a")<=e&&e<=F.CODES.get("f")?e-F.CODES.get("a")+10:F.CODES.get("A")<=e&&e<=F.CODES.get("F")?e-F.CODES.get("A")+10:-1}static escapeRune(e){let t="";if(q.isPrint(e))Ze.METACHARACTERS.indexOf(String.fromCodePoint(e))>=0&&(t+="\\"),t+=String.fromCodePoint(e);else switch(e){case F.CODES.get('"'):t+='\\"';break;case F.CODES.get("\\"):t+="\\\\";break;case F.CODES.get("	"):t+="\\t";break;case F.CODES.get(`
`):t+="\\n";break;case F.CODES.get("\r"):t+="\\r";break;case F.CODES.get("\b"):t+="\\b";break;case F.CODES.get("\f"):t+="\\f";break;default:{let n=e.toString(16);e<256?(t+="\\x",n.length===1&&(t+="0"),t+=n):t+=`\\x{${n}}`;break}}return t}static stringToRunes(e){let t=String(e),n=[],s=0;for(;s<t.length;){let i=t.codePointAt(s);n.push(i),s+=i>q.MAX_BMP?2:1}return n}static runeToString(e){return String.fromCodePoint(e)}static isWordRune(e){return e<Ga?uf[e]===1:!1}static emptyOpContext(e,t){let n=0;return e<0&&(n|=Ze.EMPTY_BEGIN_TEXT|Ze.EMPTY_BEGIN_LINE),e===10&&(n|=Ze.EMPTY_BEGIN_LINE),t<0&&(n|=Ze.EMPTY_END_TEXT|Ze.EMPTY_END_LINE),t===10&&(n|=Ze.EMPTY_END_LINE),Ze.isWordRune(e)!==Ze.isWordRune(t)?n|=Ze.EMPTY_WORD_BOUNDARY:n|=Ze.EMPTY_NO_WORD_BOUNDARY,n}static quoteMeta(e){return e.split("").map(t=>Ze.METACHARACTERS.indexOf(t)>=0?`\\${t}`:t).join("")}static charCount(e){return e>q.MAX_BMP?2:1}static toArray(e){let t=e.length,n=new Array(t);for(let s=0;s<t;s++)n[s]=e[s];return n}static stringToUtf8ByteArray(e){if(globalThis.TextEncoder)return Fa||(Fa=new TextEncoder),Fa.encode(e);{let t=[],n=0;for(let s=0;s<e.length;s++){let i=e.charCodeAt(s);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===q.MIN_HIGH_SURROGATE&&s+1<e.length&&(e.charCodeAt(s+1)&64512)===q.MIN_LOW_SURROGATE?(i=q.MIN_SUPPLEMENTARY_CODE_POINT+((i&1023)<<10)+(e.charCodeAt(++s)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t}}static utf8ByteArrayToString(e){if(globalThis.TextDecoder){xa||(xa=new TextDecoder("utf-8"));let t=e instanceof Uint8Array?e:new Uint8Array(e);return xa.decode(t)}else{let t=[],n=0,s=0;for(;n<e.length;){let i=e[n++];if(i<128)t[s++]=String.fromCharCode(i);else if(i>191&&i<224){let a=e[n++];t[s++]=String.fromCharCode((i&31)<<6|a&63)}else if(i>239&&i<365){let a=e[n++],B=e[n++],u=e[n++],l=((i&7)<<18|(a&63)<<12|(B&63)<<6|u&63)-q.MIN_SUPPLEMENTARY_CODE_POINT;t[s++]=String.fromCharCode(q.MIN_HIGH_SURROGATE+(l>>10)),t[s++]=String.fromCharCode(q.MIN_LOW_SURROGATE+(l&1023))}else{let a=e[n++],B=e[n++];t[s++]=String.fromCharCode((i&15)<<12|(a&63)<<6|B&63)}}return t.join("")}}},cf=(r=[],e=0)=>{let t=Object.create(null);for(let n=0;n<r.length;n++){let s=r[n],i=e+n;t[s]=i,t[i]=s}return Object.freeze(t)},_n=class Va{static Encoding=cf(["UTF_16","UTF_8"]);getEncoding(){throw Error("not implemented")}asCharSequence(){throw Error("not implemented")}asBytes(){throw Error("not implemented")}length(){throw Error("not implemented")}isUTF8Encoding(){return this.getEncoding()===Va.Encoding.UTF_8}isUTF16Encoding(){return this.getEncoding()===Va.Encoding.UTF_16}},Ph=class extends _n{constructor(r=null){super(),this.bytes=r}getEncoding(){return _n.Encoding.UTF_8}asCharSequence(){return K.utf8ByteArrayToString(this.bytes)}asBytes(){return this.bytes}length(){return this.bytes.length}},Ng=class extends _n{constructor(r=null){super(),this.charSequence=r}getEncoding(){return _n.Encoding.UTF_16}asCharSequence(){return this.charSequence}asBytes(){return K.stringToUtf8ByteArray(this.charSequence.toString())}length(){return this.charSequence.length}},En=class{static utf16(r){return new Ng(r)}static utf8(r){return K.isByteArray(r)?new Ph(r):new Ph(K.stringToUtf8ByteArray(r))}},je=class{static EOF(){return-8}constructor(){this.end=0}canCheckPrefix(){return!0}endPos(){return this.end}hasString(){return!1}hasAnyString(){return!1}prefixLength(){return 0}},Fg=class extends je{constructor(r,e=0,t=r.length){super(),this.bytes=r,this.start=e,this.end=t}hasString(r,e){let t=r.bytes;if(t.length===0)return!0;let n=this.indexOf(this.bytes,t,this.start+e);return n!==-1&&n<=this.end-t.length}hasAnyString(r,e){return r.ac8?r.ac8.searchUTF8(this.bytes,this.start+e,this.end):!1}step(r){if(r+=this.start,r>=this.end)return je.EOF();let e=this.bytes[r]&255;if(e<128)return e<<3|1;if(e>=194&&e<=223&&r+1<this.end){let t=this.bytes[r+1]&255;return(t&192)!==128?e<<3|1:((e&31)<<6|t&63)<<3|2}else if(e>=224&&e<=239&&r+2<this.end){let t=this.bytes[r+1]&255;if((t&192)!==128)return e<<3|1;let n=this.bytes[r+2]&255;return(n&192)!==128?e<<3|1:((e&15)<<12|(t&63)<<6|n&63)<<3|3}else if(e>=240&&e<=244&&r+3<this.end){let t=this.bytes[r+1]&255;if((t&192)!==128)return e<<3|1;let n=this.bytes[r+2]&255;if((n&192)!==128)return e<<3|1;let s=this.bytes[r+3]&255;return(s&192)!==128?e<<3|1:((e&7)<<18|(t&63)<<12|(n&63)<<6|s&63)<<3|4}else return e<<3|1}index(r,e){e+=this.start;let t=this.indexOf(this.bytes,r.prefixUTF8,e);return t<0?t:t-e}context(r){r+=this.start;let e=-1;if(r>this.start&&r<=this.end){let n=r-1;if(e=this.bytes[n--],e>=128){let s=r-4;for(s<this.start&&(s=this.start);n>=s&&(this.bytes[n]&192)===128;)n--;n<this.start&&(n=this.start),e=this.step(n-this.start)>>3}}let t=r<this.end?this.step(r-this.start)>>3:-1;return K.emptyOpContext(e,t)}indexOf(r,e,t=0){let n=e.length;if(n===0)return t<=this.end?t:-1;let s=e[0],i=this.end-n,a=typeof r.indexOf=="function",B=t;for(;B<=i;){if(a){if(B=r.indexOf(s,B),B===-1||B>i)return-1}else{for(;B<=i&&r[B]!==s;)B++;if(B>i)return-1}let u=!0;for(let l=1;l<n;l++)if(r[B+l]!==e[l]){u=!1;break}if(u)return B;B++}return-1}prefixLength(r){return r.prefixUTF8.length}},xg=class extends je{constructor(r,e=0,t=r.length){super(),this.charSequence=r,this.start=e,this.end=t}hasString(r,e){let t=this.charSequence.indexOf(r.str,this.start+e);return t!==-1&&t<=this.end-r.str.length}hasAnyString(r,e){return r.ac16?r.ac16.searchUTF16(this.charSequence,this.start+e,this.end):!1}step(r){if(r+=this.start,r>=this.end)return je.EOF();let e=this.charSequence.charCodeAt(r);if(e<q.MIN_HIGH_SURROGATE||e>q.MAX_HIGH_SURROGATE||r+1>=this.end)return e<<3|1;let t=this.charSequence.charCodeAt(r+1);return t>=q.MIN_LOW_SURROGATE&&t<=q.MAX_LOW_SURROGATE?(e-q.MIN_HIGH_SURROGATE)*1024+(t-q.MIN_LOW_SURROGATE)+q.MIN_SUPPLEMENTARY_CODE_POINT<<3|2:e<<3|1}index(r,e){e+=this.start;let t=this.charSequence.indexOf(r.prefix,e);return t<0||t>this.end-r.prefix.length?-1:t-e}context(r){r+=this.start;let e=r>this.start&&r<=this.end?this.charSequence.charCodeAt(r-1):-1,t=r<this.end?this.charSequence.charCodeAt(r):-1;return K.emptyOpContext(e,t)}prefixLength(r){return r.prefix.length}},fe=class{static fromUTF8(r,e=0,t=r.length){return new Fg(r,e,t)}static fromUTF16(r,e=0,t=r.length){return new xg(r,e,t)}},ts=class extends Error{constructor(r){super(r),this.name="RE2JSException"}},de=class extends ts{constructor(r,e=null){let t=`error parsing regexp: ${r}`;e&&(t+=`: \`${e}\``),super(t),this.name="RE2JSSyntaxException",this.message=t,this.error=r,this.input=e}getDescription(){return this.error}getPattern(){return this.input}},lf=class extends ts{constructor(r){super(r),this.name="RE2JSCompileException"}},ze=class extends ts{constructor(r){super(r),this.name="RE2JSGroupException"}},Pg=class extends ts{constructor(r){super(r),this.name="RE2JSFlagsException"}},Zr=class extends ts{constructor(r){super(r),this.name="RE2JSInternalException"}},Oh=class hf{static MAX_REPLACER_ARGS=65535;static quoteReplacement(e,t=!1){return t?e.indexOf("\\")<0&&e.indexOf("$")<0?e:e.split("").map(n=>{let s=n.codePointAt(0);return s===F.CODES.get("\\")||s===F.CODES.get("$")?`\\${n}`:n}).join(""):e.indexOf("$")<0?e:e.split("").map(n=>n.codePointAt(0)===F.CODES.get("$")?"$$":n).join("")}constructor(e,t){if(e===null)throw new Error("pattern is null");this.patternInput=e;let n=this.patternInput.re2();this.patternGroupCount=n.numberOfCapturingGroups(),this.groups=[],this.namedGroups=n.namedGroups,this.numberOfInstructions=n.numberOfInstructions(),t instanceof _n?this.resetMatcherInput(t):K.isByteArray(t)?this.resetMatcherInput(En.utf8(t)):this.resetMatcherInput(En.utf16(t))}pattern(){return this.patternInput}reset(){return this.matcherInputLength=this.matcherInput.length(),this.appendPos=0,this.hasMatch=!1,this.hasGroups=!1,this.anchorFlag=0,this}resetMatcherInput(e){if(e===null)throw new Error("input is null");return e instanceof _n||(K.isByteArray(e)?e=En.utf8(e):e=En.utf16(e)),this.matcherInput=e,this.reset(),this}start(e=0){if(typeof e=="string"){let t=this.namedGroups[e];if(!Number.isFinite(t))throw new ze(`group '${e}' not found`);e=t}return this.loadGroup(e),this.groups[2*e]}end(e=0){if(typeof e=="string"){let t=this.namedGroups[e];if(!Number.isFinite(t))throw new ze(`group '${e}' not found`);e=t}return this.loadGroup(e),this.groups[2*e+1]}programSize(){return this.numberOfInstructions}group(e=0){if(typeof e=="string"){let s=this.namedGroups[e];if(!Number.isFinite(s))throw new ze(`group '${e}' not found`);e=s}let t=this.start(e),n=this.end(e);return t<0&&n<0?null:this.substring(t,n)}getNamedGroups(){if(!this.hasMatch)throw new ze("perhaps no match attempted");let e=Object.create(null);for(let t of Object.keys(this.namedGroups))e[t]=this.group(t);return e}groupCount(){return this.patternGroupCount}loadGroup(e){if(e<0||e>this.patternGroupCount)throw new ze(`Group index out of bounds: ${e}`);if(!this.hasMatch)throw new ze("perhaps no match attempted");if(e===0||this.hasGroups)return;let t=this.matcherInputLength,n=this.patternInput.re2().matchMachineInput(this.matcherInput,this.groups[0],t,this.anchorFlag,1+this.patternGroupCount);if(!n[0])throw new ze("inconsistency in matching group data");this.groups=n[1],this.hasGroups=!0}matches(){return this.genMatch(0,O.ANCHOR_BOTH)}lookingAt(){return this.genMatch(0,O.ANCHOR_START)}find(e=null){if(e!==null){if(e<0||e>this.matcherInputLength)throw new ze(`start index out of bounds: ${e}`);return this.reset(),this.genMatch(e,0)}if(e=0,this.hasMatch&&(e=this.groups[1],this.groups[0]===this.groups[1])){let t=(this.matcherInput.isUTF16Encoding()?fe.fromUTF16(this.matcherInput.asCharSequence(),0,this.matcherInputLength):fe.fromUTF8(this.matcherInput.asBytes(),0,this.matcherInputLength)).step(e);t<0?e++:e+=t&7}return this.genMatch(e,O.UNANCHORED)}genMatch(e,t){let n=this.patternInput.re2().matchMachineInput(this.matcherInput,e,this.matcherInputLength,t,1);return n[0]?(this.groups=n[1],this.hasMatch=!0,this.hasGroups=this.patternGroupCount===0,this.anchorFlag=t,!0):(this.hasMatch=!1,!1)}substring(e,t){return this.matcherInput.isUTF8Encoding()?K.utf8ByteArrayToString(this.matcherInput.asBytes().slice(e,t)):this.matcherInput.asCharSequence().substring(e,t).toString()}inputLength(){return this.matcherInputLength}appendReplacement(e,t=!1){let n="",s=this.start(),i=this.end();return this.appendPos<s&&(n+=this.substring(this.appendPos,s)),this.appendPos=i,n+=t?this.appendReplacementInternalJava(e):this.appendReplacementInternalJs(e),n}appendReplacementInternalJava(e){let t="",n=0,s=e.length,i=0;for(;i<s;){let a=e.codePointAt(i);if(a===F.CODES.get("\\")){if(n<i&&(t+=e.substring(n,i)),i++,i>=s)throw new ze("character to be escaped is missing");n=i,i++;continue}if(a===F.CODES.get("$")){if(n<i&&(t+=e.substring(n,i)),i+1>=s)throw new ze("Illegal group reference: group index is missing");let B=e.codePointAt(i+1);if(F.CODES.get("0")<=B&&B<=F.CODES.get("9")){let u=B-F.CODES.get("0"),l=i+2;for(;l<s;l++){let C=e.codePointAt(l);if(C<F.CODES.get("0")||C>F.CODES.get("9")||u*10+C-F.CODES.get("0")>this.patternGroupCount)break;u=u*10+C-F.CODES.get("0")}if(u>this.patternGroupCount)throw new ze(`n > number of groups: ${u}`);let f=this.group(u);f!==null&&(t+=f),i=l,n=i}else if(B===F.CODES.get("{")){let u=i+2;for(;u<s&&e.codePointAt(u)!==F.CODES.get("}");)u++;if(u>=s)throw new ze("named capture group is missing trailing '}'");let l=e.substring(i+2,u),f=this.group(l);f!==null&&(t+=f),i=u+1,n=i}else throw new ze("Illegal group reference");continue}i++}return n<s&&(t+=e.substring(n,s)),t}appendReplacementInternalJs(e){let t="",n=0,s=e.length;for(let i=0;i<s-1;i++)if(e.codePointAt(i)===F.CODES.get("$")){let a=e.codePointAt(i+1);if(F.CODES.get("$")===a){n<i&&(t+=e.substring(n,i)),t+="$",i++,n=i+1;continue}else if(F.CODES.get("&")===a){n<i&&(t+=e.substring(n,i));let B=this.group(0);B!==null?t+=B:t+="$&",i++,n=i+1;continue}else if(F.CODES.get("`")===a){n<i&&(t+=e.substring(n,i)),t+=this.substring(0,this.start(0)),i++,n=i+1;continue}else if(F.CODES.get("'")===a){n<i&&(t+=e.substring(n,i)),t+=this.substring(this.end(0),this.matcherInputLength),i++,n=i+1;continue}else if(F.CODES.get("1")<=a&&a<=F.CODES.get("9")){let B=a-F.CODES.get("0");for(n<i&&(t+=e.substring(n,i)),i+=2;i<s&&(a=e.codePointAt(i),!(a<F.CODES.get("0")||a>F.CODES.get("9")||B*10+a-F.CODES.get("0")>this.patternGroupCount));i++)B=B*10+a-F.CODES.get("0");if(B>this.patternGroupCount){t+=`$${B}`,n=i,i--;continue}let u=this.group(B);u!==null&&(t+=u),n=i,i--;continue}else if(a===F.CODES.get("<")){n<i&&(t+=e.substring(n,i)),i++;let B=i+1;for(;B<e.length&&e.codePointAt(B)!==F.CODES.get(">")&&e.codePointAt(B)!==F.CODES.get(" ");)B++;if(B===e.length||e.codePointAt(B)!==F.CODES.get(">")){t+=e.substring(i-1,B+1),n=B+1,i=B;continue}let u=e.substring(i+1,B);if(Object.prototype.hasOwnProperty.call(this.namedGroups,u)){let l=this.group(u);l!==null&&(t+=l)}else t+=`$<${u}>`;n=B+1,i=B;continue}}return n<s&&(t+=e.substring(n,s)),t}appendTail(){return this.substring(this.appendPos,this.matcherInputLength)}replaceAll(e,t=!1){return this.replace(e,!0,t)}replaceFirst(e,t=!1){return this.replace(e,!1,t)}replace(e,t=!0,n=!1){let s="";this.reset();let i=typeof e=="function",a=Object.keys(this.namedGroups).length>0,B=null;if(i){if(this.groupCount()>=hf.MAX_REPLACER_ARGS)throw new ze("Too many capture groups to safely invoke replacer function");B=this.matcherInput.isUTF8Encoding()?this.matcherInput.asBytes():this.matcherInput.asCharSequence()}for(;this.find()&&(s+=i?this.appendReplacementFunc(e,a,B):this.appendReplacement(e,n),!!t););return s+=this.appendTail(),s}appendReplacementFunc(e,t,n){let s="",i=this.start(),a=this.end();this.appendPos<i&&(s+=this.substring(this.appendPos,i)),this.appendPos=a;let B=this.buildReplacerArgs(i,t,n);return s+=String(e(...B)),s}buildReplacerArgs(e,t,n){let s=[this.group(0)],i=this.groupCount();for(let a=1;a<=i;a++){let B=this.start(a);B<0?s.push(void 0):s.push(this.substring(B,this.end(a)))}if(s.push(e),s.push(n),t){let a=this.getNamedGroups();for(let B in a)a[B]===null&&(a[B]=void 0);s.push(a)}return s}},x=class Fe{static ALT=1;static ALT_MATCH=2;static CAPTURE=3;static EMPTY_WIDTH=4;static FAIL=5;static MATCH=6;static NOP=7;static RUNE=8;static RUNE1=9;static RUNE_ANY=10;static RUNE_ANY_NOT_NL=11;static LB_WRITE=12;static LB_CHECK=13;static isRuneOp(e){return Fe.RUNE<=e&&e<=Fe.RUNE_ANY_NOT_NL}static escapeRunes(e){let t='"';for(let n of e)t+=K.escapeRune(n);return t+='"',t}constructor(e){this.op=e,this.out=0,this.arg=0,this.runes=[],this.next=null}matchRune(e){if(this.runes.length===1){let a=this.runes[0];return(this.arg&O.FOLD_CASE)!==0?q.equalsIgnoreCase(a,e):e===a}let t=this.runes.length;if(t===0)return!1;if(t===2||t===4||t===6||t===8){for(let a=0;a<t;a+=2){if(e<this.runes[a])return!1;if(e<=this.runes[a+1])return!0}return!1}let n=0,s=t>>1;for(;s>1;){let a=s>>1;n+=this.runes[n+a<<1]<=e?a:0,s-=a}n+=this.runes[n<<1]<=e?1:0;let i=n-1;return i>=0&&e<=this.runes[i<<1|1]}matchRunePos(e){if(this.runes.length===1){let a=this.runes[0];return(this.arg&O.FOLD_CASE)!==0?q.equalsIgnoreCase(a,e)?0:-1:e===a?0:-1}let t=this.runes.length;if(t===0)return-1;if(t===2||t===4||t===6||t===8){for(let a=0;a<t;a+=2){if(e<this.runes[a])return-1;if(e<=this.runes[a+1])return Math.floor(a/2)}return-1}let n=0,s=t>>1;for(;s>1;){let a=s>>1;n+=this.runes[n+a<<1]<=e?a:0,s-=a}n+=this.runes[n<<1]<=e?1:0;let i=n-1;return i>=0&&e<=this.runes[i<<1|1]?i:-1}toString(){switch(this.op){case Fe.ALT:return`alt -> ${this.out}, ${this.arg}`;case Fe.ALT_MATCH:return`altmatch -> ${this.out}, ${this.arg}`;case Fe.CAPTURE:return`cap ${this.arg} -> ${this.out}`;case Fe.EMPTY_WIDTH:return`empty ${this.arg} -> ${this.out}`;case Fe.MATCH:return`match${this.arg!==0?` ${this.arg}`:""}`;case Fe.FAIL:return"fail";case Fe.NOP:return`nop -> ${this.out}`;case Fe.LB_WRITE:return`lbwrite ${this.arg} -> ${this.out}`;case Fe.LB_CHECK:return`lbcheck ${this.arg} -> ${this.out}`;case Fe.RUNE:return this.runes===null?"rune <null>":["rune ",Fe.escapeRunes(this.runes),(this.arg&O.FOLD_CASE)!==0?"/i":""," -> ",this.out].join("");case Fe.RUNE1:return`rune1 ${Fe.escapeRunes(this.runes)} -> ${this.out}`;case Fe.RUNE_ANY:return`any -> ${this.out}`;case Fe.RUNE_ANY_NOT_NL:return`anynotnl -> ${this.out}`;default:throw new Error("unhandled case in Inst.toString")}}},Lh=class{constructor(r){this.sparse=new Int32Array(r),this.densePcs=new Int32Array(r),this.denseCaps=null,this.size=0,this.ncap=0}init(r){this.ncap=r;let e=this.densePcs.length*r;(!this.denseCaps||this.denseCaps.length<e)&&(this.denseCaps=new Int32Array(e))}contains(r){let e=this.sparse[r];return e<this.size&&this.densePcs[e]===r}isEmpty(){return this.size===0}add(r){let e=this.size++;return this.sparse[r]=e,this.densePcs[e]=r,e}clear(){this.size=0}toString(){let r="{";for(let e=0;e<this.size;e++)e!==0&&(r+=", "),r+=this.densePcs[e];return r+="}",r}},ff=class ka{static fromRE2(e){let t=new ka;return t.prog=e.prog,t.re2=e,t.q0=new Lh(t.prog.numInst()),t.q1=new Lh(t.prog.numInst()),t.matched=!1,t.matchcap=new Int32Array(t.prog.numCap<2?2:t.prog.numCap),t.ncap=0,t}static fromMachine(e){return ka.fromRE2(e.re2)}constructor(){this.prog=null,this.re2=null,this.q0=null,this.q1=null,this.matched=!1,this.matchcap=null,this.ncap=0,this.lbTable=null}init(e){this.ncap=e,e>this.matchcap.length?this.matchcap=new Int32Array(e).fill(-1):this.matchcap.fill(-1),this.q0.init(e),this.q1.init(e),this.prog.numLb>0&&((!this.lbTable||this.lbTable.length<this.prog.numLb+1)&&(this.lbTable=new Int32Array(this.prog.numLb+1)),this.lbTable.fill(-1))}submatches(){return this.ncap===0?K.emptyInts():K.toArray(this.matchcap.subarray(0,this.ncap))}match(e,t,n){let s=this.re2.cond;if(s===K.EMPTY_ALL||(n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&t!==0)return!1;this.matched=!1,this.matchcap.fill(-1);let i=this.prog.numLb>0?0:t,a=t,B=this.q0,u=this.q1,l=e.step(i),f=l>>3,C=l&7,D=-1,v=0;l!==je.EOF()&&(l=e.step(i+C),D=l>>3,v=l&7);let R;for(i===0?R=K.emptyOpContext(-1,f):R=e.context(i);;){if(B.isEmpty()){if((s&K.EMPTY_BEGIN_TEXT)!==0&&i!==0||(n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&i!==0||this.matched)break;if(this.prog.numLb===0&&this.re2.prefix.length!==0&&D!==this.re2.prefixRune&&e.canCheckPrefix()){let z=e.index(this.re2,i);if(z<0)break;i+=z,l=e.step(i),f=l>>3,C=l&7,l=e.step(i+C),D=l>>3,v=l&7,R=e.context(i)}}if(i===0&&this.prog.numLb>0)for(let z=0;z<this.prog.lbStarts.length;z++)this.add(B,this.prog.lbStarts[z],i,this.matchcap,0,R);!this.matched&&(i===0||n===O.UNANCHORED)&&i>=a&&(this.ncap>0&&(this.matchcap[0]=i),this.add(B,this.prog.start,i,this.matchcap,0,R));let V=i+C;if(R=e.context(V),this.step(B,u,i,V,f,R,n,i===e.endPos()),C===0||this.ncap===0&&this.matched)break;i+=C,f=D,C=v,f!==-1&&(l=e.step(i+C),D=l>>3,v=l&7);let H=B;B=u,u=H}return u.clear(),this.matched}matchSet(e,t,n){let s=this.re2.cond;if(s===K.EMPTY_ALL)return[];if((n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&t!==0)return[];let i=this.prog.numLb>0?0:t,a=t,B=this.q0,u=this.q1,l=e.step(i),f=l>>3,C=l&7,D=-1,v=0;l!==je.EOF()&&(l=e.step(i+C),D=l>>3,v=l&7);let R=i===0?K.emptyOpContext(-1,f):e.context(i),V=new Set;for(;!(B.isEmpty()&&((s&K.EMPTY_BEGIN_TEXT)!==0&&i!==0||(n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&i!==0));){if(i===0&&this.prog.numLb>0)for(let re=0;re<this.prog.lbStarts.length;re++)this.add(B,this.prog.lbStarts[re],i,this.matchcap,0,R);(i===0||n===O.UNANCHORED)&&i>=a&&this.add(B,this.prog.start,i,this.matchcap,0,R);let H=i+C;R=e.context(H);for(let re=0;re<B.size;re++){let ce=B.densePcs[re],ee=this.prog.inst[ce],pe=re*this.ncap,me=!1;switch(ee.op){case x.MATCH:if(n===O.ANCHOR_BOTH&&i!==e.endPos())break;V.add(ee.arg);break;case x.RUNE:me=ee.matchRune(f);break;case x.RUNE1:me=f===ee.runes[0];break;case x.RUNE_ANY:me=!0;break;case x.RUNE_ANY_NOT_NL:me=f!==10;break;default:continue}me&&this.add(u,ee.out,H,B.denseCaps,pe,R)}if(B.clear(),C===0)break;i+=C,f=D,C=v,f!==-1&&(l=e.step(i+C),D=l>>3,v=l&7);let z=B;B=u,u=z}return u.clear(),Array.from(V).sort((H,z)=>H-z)}step(e,t,n,s,i,a,B,u){let l=this.re2.longest;for(let f=0;f<e.size;f++){let C=e.densePcs[f],D=f*this.ncap;if(l&&this.matched&&this.ncap>0&&this.matchcap[0]<e.denseCaps[D])continue;let v=this.prog.inst[C],R=!1;switch(v.op){case x.MATCH:if(B===O.ANCHOR_BOTH&&!u)break;if(this.ncap>0&&(!l||!this.matched||this.matchcap[1]<n)){e.denseCaps[D+1]=n;for(let V=0;V<this.ncap;V++)this.matchcap[V]=e.denseCaps[D+V]}l||(e.size=0),this.matched=!0;break;case x.RUNE:R=v.matchRune(i);break;case x.RUNE1:R=i===v.runes[0];break;case x.RUNE_ANY:R=!0;break;case x.RUNE_ANY_NOT_NL:R=i!==10;break;default:continue}R&&this.add(t,v.out,s,e.denseCaps,D,a)}e.clear()}add(e,t,n,s,i,a){for(;;){if(t===0||e.contains(t))return;let B=e.add(t),u=this.prog.inst[t];switch(u.op){case x.FAIL:return;case x.ALT:case x.ALT_MATCH:this.add(e,u.out,n,s,i,a),t=u.arg;continue;case x.EMPTY_WIDTH:if((u.arg&~a)===0){t=u.out;continue}return;case x.NOP:t=u.out;continue;case x.CAPTURE:if(u.arg<this.ncap){let l=s[i+u.arg];s[i+u.arg]=n,this.add(e,u.out,n,s,i,a),s[i+u.arg]=l;return}else{t=u.out;continue}case x.LB_WRITE:this.lbTable[Math.abs(u.arg)]=n,t=u.out;continue;case x.LB_CHECK:if(u.arg>0){if(this.lbTable[u.arg]===n){t=u.out;continue}}else if(this.lbTable[-u.arg]!==n){t=u.out;continue}return;case x.MATCH:case x.RUNE:case x.RUNE1:case x.RUNE_ANY:case x.RUNE_ANY_NOT_NL:if(this.ncap>0){let l=B*this.ncap;for(let f=0;f<this.ncap;f++)e.denseCaps[l+f]=s[i+f]}return;default:throw new Zr("unhandled")}}}},Vh=r=>{let e=-2128831035;for(let t=0;t<r.length;t++)e^=r[t],e=Math.imul(e,16777619);return e},Og=(r,e)=>{if(r.length!==e.length)return!1;for(let t=0;t<r.length;t++)if(r[t]!==e[t])return!1;return!0},Lg=class{constructor(r,e,t=[]){this.nfaStates=r,this.isMatch=e,this.matchIDs=t,this.nextLatin1=new Array(q.MAX_LATIN1+1).fill(null),this.nextLatin1Anchored=new Array(q.MAX_LATIN1+1).fill(null),this.transKeys=[],this.transVals=[],this.lastSeen=0}},df=class Ma{static MAX_CACHE_CLEARS=5;static STATE_MEMORY_ESTIMATE=838;constructor(e,t=8388608){this.prog=e,this.stateCache=new Map,this.stateCount=0,this.startState=null,this.stateLimit=Math.max(1,Math.floor(t/Ma.STATE_MEMORY_ESTIMATE)),this.cacheClears=0,this.failed=!1,this.clock=0}computeClosure(e){let t=new Set,n=[...e],s=!1,i=[];for(;n.length>0;){let B=n.pop();if(t.has(B))continue;t.add(B);let u=this.prog.getInst(B);switch(u.op){case x.MATCH:s=!0,i.includes(u.arg)||i.push(u.arg);break;case x.ALT:case x.ALT_MATCH:n.push(u.out),n.push(u.arg);break;case x.NOP:case x.CAPTURE:n.push(u.out);break;case x.EMPTY_WIDTH:case x.LB_WRITE:case x.LB_CHECK:return null}}let a=Int32Array.from(t).sort();return i.sort((B,u)=>B-u),{pcs:a,isMatch:s,matchIDs:i}}getState(e){let t=this.computeClosure(e);if(!t)return null;let n=t.pcs,s=Vh(n),i=this.stateCache.get(s);if(i)for(let B=0;B<i.length;B++){let u=i[B];if(Og(u.nfaStates,n))return u.lastSeen=++this.clock,u}else i=[],this.stateCache.set(s,i);if(this.failed)return null;if(this.stateCount>=this.stateLimit){if(this.cacheClears++,this.cacheClears>=Ma.MAX_CACHE_CLEARS)return this.failed=!0,this.stateCache.clear(),this.stateCount=0,this.startState=null,null;this.evictCache(),i=this.stateCache.get(s),i||(i=[],this.stateCache.set(s,i))}let a=new Lg(n,t.isMatch,t.matchIDs);return a.lastSeen=++this.clock,i.push(a),this.stateCount++,a}evictCache(){let e=[];for(let a of this.stateCache.values())for(let B=0;B<a.length;B++)e.push(a[B]);e.sort((a,B)=>a.lastSeen-B.lastSeen);let t=Math.max(1,Math.floor(this.stateLimit/2)),n=e.length-t,s=e.slice(n),i=new Set(s);this.stateCache.clear(),this.stateCount=0;for(let a=0;a<s.length;a++){let B=s[a];B.nextLatin1.fill(null),B.nextLatin1Anchored.fill(null),B.transKeys.length=0,B.transVals.length=0;let u=Vh(B.nfaStates),l=this.stateCache.get(u);l||(l=[],this.stateCache.set(u,l)),l.push(B),this.stateCount++}this.startState&&!i.has(this.startState)&&(this.startState=null)}step(e,t,n){if(t<=q.MAX_LATIN1)if(n===O.UNANCHORED){let a=e.nextLatin1[t];if(a!==null)return a}else{let a=e.nextLatin1Anchored[t];if(a!==null)return a}else{let a=t+(n===O.UNANCHORED?0:q.MAX_RUNE+1),B=e.transKeys,u=B.length;for(let l=0;l<u;l++)if(B[l]===a)return e.transVals[l]}let s=[];for(let a=0;a<e.nfaStates.length;a++){let B=e.nfaStates[a],u=this.prog.getInst(B);x.isRuneOp(u.op)&&u.matchRune(t)&&s.push(u.out)}n===O.UNANCHORED&&s.push(this.prog.start);let i=this.getState(s);if(t<=q.MAX_LATIN1)n===O.UNANCHORED?e.nextLatin1[t]=i:e.nextLatin1Anchored[t]=i;else{let a=t+(n===O.UNANCHORED?0:q.MAX_RUNE+1);e.transKeys.push(a),e.transVals.push(i)}return i}match(e,t,n){if((n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&t!==0)return!1;if(!this.startState&&(this.startState=this.getState([this.prog.start]),!this.startState))return null;let s=e.endPos(),i=this.startState;if(i.isMatch)if(n===O.ANCHOR_BOTH){if(t===s)return!0}else return!0;let a=t;for(;a<s;){let B=e.step(a),u=B>>3,l=B&7;if(l===0)break;if(i=n===O.UNANCHORED&&u<=q.MAX_LATIN1&&i.nextLatin1[u]||this.step(i,u,n),i===null)return null;if(i.lastSeen=++this.clock,i.isMatch)if(n===O.ANCHOR_BOTH){if(a+l===s)return!0}else return!0;if(i.nfaStates.length===0&&n!==O.UNANCHORED)return!1;a+=l}return!1}matchSet(e,t,n){if((n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&t!==0)return[];if(!this.startState&&(this.startState=this.getState([this.prog.start]),!this.startState))return null;let s=e.endPos(),i=this.startState,a=new Set,B=(l,f)=>{l.isMatch&&(n===O.ANCHOR_BOTH?f===s&&l.matchIDs.forEach(C=>a.add(C)):l.matchIDs.forEach(C=>a.add(C)))};B(i,t);let u=t;for(;u<s;){let l=e.step(u),f=l>>3,C=l&7;if(C===0)break;if(i=n===O.UNANCHORED&&f<=q.MAX_LATIN1&&i.nextLatin1[f]||this.step(i,f,n),i===null)return null;if(i.lastSeen=++this.clock,u+=C,B(i,u),i.nfaStates.length===0&&n!==O.UNANCHORED)break}return Array.from(a).sort((l,f)=>l-f)}},Vg=32,kg=500,Pa=256,Mg=256*1024,Gg=class{constructor(){this.end=0,this.cap=new Int32Array(0),this.matchcap=new Int32Array(0),this.ncap=0,this.jobPc=new Int32Array(Pa),this.jobArg=new Uint8Array(Pa),this.jobPos=new Int32Array(Pa),this.jobLen=0,this.visited=new Uint32Array(0)}reset(r,e,t){this.end=e,this.jobLen=0,this.ncap=t;let n=r.numInst()*(e+1)+Vg-1>>>5;this.visited.length<n?this.visited=new Uint32Array(n):this.visited.fill(0,0,n),this.cap.length<t?this.cap=new Int32Array(t).fill(-1):this.cap.fill(-1,0,t),this.matchcap.length<t?this.matchcap=new Int32Array(t).fill(-1):this.matchcap.fill(-1,0,t)}shouldVisit(r,e){let t=r*(this.end+1)+e,n=t>>>5,s=1<<(t&31);return(this.visited[n]&s)!==0?!1:(this.visited[n]|=s,!0)}push(r,e,t,n){if(r.prog.getInst(e).op!==x.FAIL&&(n||this.shouldVisit(e,t))){if(this.jobLen>=this.jobPc.length){let s=this.jobPc.length*2,i=new Int32Array(s);i.set(this.jobPc),this.jobPc=i;let a=new Uint8Array(s);a.set(this.jobArg),this.jobArg=a;let B=new Int32Array(s);B.set(this.jobPos),this.jobPos=B}this.jobPc[this.jobLen]=e,this.jobArg[this.jobLen]=n?1:0,this.jobPos[this.jobLen]=t,this.jobLen++}}tryBacktrack(r,e,t,n,s){let i=r.longest;for(this.push(r,t,n,!1);this.jobLen>0;){this.jobLen--;let a=this.jobPc[this.jobLen],B=this.jobArg[this.jobLen]===1,u=this.jobPos[this.jobLen],l=!0;for(;!(!l&&!this.shouldVisit(a,u));){l=!1;let f=r.prog.getInst(a);switch(f.op){case x.FAIL:throw new Zr("unexpected InstFail");case x.ALT:if(B){B=!1,a=f.arg;continue}else{this.push(r,a,u,!0),a=f.out;continue}case x.ALT_MATCH:{let C=r.prog.getInst(f.out);if(x.isRuneOp(C.op)){this.push(r,f.arg,u,!1),a=f.arg,u=this.end;continue}this.push(r,f.out,this.end,!1),a=f.out;continue}case x.RUNE:{let C=e.step(u);if(C===je.EOF()||!f.matchRune(C>>3))break;u+=C&7,a=f.out;continue}case x.RUNE1:{let C=e.step(u);if(C===je.EOF()||C>>3!==f.runes[0])break;u+=C&7,a=f.out;continue}case x.RUNE_ANY_NOT_NL:{let C=e.step(u);if(C===je.EOF()||C>>3===10)break;u+=C&7,a=f.out;continue}case x.RUNE_ANY:{let C=e.step(u);if(C===je.EOF())break;u+=C&7,a=f.out;continue}case x.CAPTURE:if(B){this.cap[f.arg]=u;break}else{f.arg<this.ncap&&(this.push(r,a,this.cap[f.arg],!0),this.cap[f.arg]=u),a=f.out;continue}case x.EMPTY_WIDTH:{let C=e.context(u);if((f.arg&~C)!==0)break;a=f.out;continue}case x.NOP:a=f.out;continue;case x.MATCH:{if(s===O.ANCHOR_BOTH&&u!==this.end)break;if(this.ncap===0)return!0;this.ncap>1&&(this.cap[1]=u);let C=this.matchcap[1];if((C===-1||i&&u>0&&u>C)&&this.matchcap.set(this.cap),!i||u===this.end)return!0;break}case x.LB_WRITE:case x.LB_CHECK:throw new Zr("Backtracker cannot evaluate Lookbehind instructions");default:throw new Zr("bad inst")}break}}return i&&this.matchcap.length>1&&this.matchcap[1]>=0}},_i=[],Di=class Cf{static shouldBacktrack(e){return e.numInst()<=kg}static maxBitStateLen(e){return Cf.shouldBacktrack(e)?Math.floor(Mg/e.numInst()):0}static execute(e,t,n,s,i){let a=e.cond;if(a===K.EMPTY_ALL||(s===O.ANCHOR_START||s===O.ANCHOR_BOTH)&&n!==0||(a&K.EMPTY_BEGIN_TEXT)!==0&&n!==0)return null;let B=_i.length>0?_i.pop():new Gg,u=t.endPos();B.reset(e.prog,u,i);let l=!1;if((a&K.EMPTY_BEGIN_TEXT)!==0||s===O.ANCHOR_START||s===O.ANCHOR_BOTH)B.ncap>0&&(B.cap[0]=n),B.tryBacktrack(e,t,e.prog.start,n,s)&&(l=!0);else{let C=-1;for(;n<=u&&C!==0;n+=C){if(e.prefix.length>0){let v=t.index(e,n);if(v<0)break;n+=v}if(B.ncap>0&&(B.cap[0]=n),B.tryBacktrack(e,t,e.prog.start,n,s)){l=!0;break}let D=t.step(n);C=D===je.EOF()?0:D&7}}if(!l)return _i.push(B),null;let f=i===0?[]:K.toArray(B.matchcap.subarray(0,i));return _i.push(B),f}},kh=class{constructor(r){this.sparse=new Uint32Array(r),this.dense=new Uint32Array(r),this.size=0,this.nextIndex=0}empty(){return this.nextIndex>=this.size}next(){return this.dense[this.nextIndex++]}clear(){this.size=0,this.nextIndex=0}contains(r){return r<this.sparse.length&&this.sparse[r]<this.size&&this.dense[this.sparse[r]]===r}insert(r){this.contains(r)||this.insertNew(r)}insertNew(r){r>=this.sparse.length||(this.sparse[r]=this.size,this.dense[this.size]=r,this.size++)}},Hg=(r,e,t,n)=>{let s=r.length,i=e.length,a=0,B=0,u=[],l=[],f=!0,C=-1,D=v=>{let R=v?r:e,V=v?a:B,H=v?t:n;return C>0&&R[V]<=u[C]?!1:(u.push(R[V],R[V+1]),v?a+=2:B+=2,C+=2,l.push(H),!0)};for(;a<s||B<i;)if(B>=i?f=D(!0):a>=s||e[B]<r[a]?f=D(!1):f=D(!0),!f)return null;return{merged:u,next:l}},Ug=class{constructor(r){this.start=r.start,this.numCap=r.numCap,this.inst=new Array(r.inst.length);for(let e=0;e<r.inst.length;e++){let t=r.inst[e],n=new x(t.op);n.out=t.out,n.arg=t.arg,n.runes=t.runes?t.runes.slice():[],n.next=null,this.inst[e]=n}}},qg=r=>{let e=new Ug(r);for(let t=0;t<e.inst.length;t++){let n=e.inst[t];if(n.op!==x.ALT&&n.op!==x.ALT_MATCH)continue;let s="out",i="arg",a=e.inst[n[i]];if(a.op!==x.ALT&&a.op!==x.ALT_MATCH&&(s="arg",i="out",a=e.inst[n[i]],a.op!==x.ALT&&a.op!==x.ALT_MATCH))continue;let B=e.inst[n[s]];if(B.op===x.ALT||B.op===x.ALT_MATCH)continue;let u="out",l="arg",f=!1;a.out===t?f=!0:a.arg===t&&(f=!0,u="arg",l="out"),f&&(a[u]=n[s]),n[s]===a[u]&&(n[i]=a[l])}return e},jg=r=>{if(r.inst.length>=1e3)return null;let e=new kh(r.inst.length),t=new kh(r.inst.length),n=new Array(r.inst.length),s=new Array(r.inst.length).fill(!1),i=a=>{let B=!0,u=r.inst[a];if(t.contains(a))return!0;switch(t.insert(a),u.op){case x.ALT:case x.ALT_MATCH:{B=i(u.out)&&i(u.arg);let l=s[u.out],f=s[u.arg];if(l&&f)return!1;if(f){let R=u.out;u.out=u.arg,u.arg=R;let V=l;l=f,f=V}l&&(s[a]=!0,u.op=x.ALT_MATCH);let C=n[u.out]||[],D=n[u.arg]||[],v=Hg(C,D,u.out,u.arg);if(!v)return!1;n[a]=v.merged,u.next=new Uint32Array(v.next);break}case x.CAPTURE:case x.EMPTY_WIDTH:case x.NOP:B=i(u.out),s[a]=s[u.out],n[a]=n[u.out]?n[u.out].slice():[],u.next=new Uint32Array(Math.floor(n[a].length/2)+1).fill(u.out);break;case x.MATCH:case x.FAIL:s[a]=u.op===x.MATCH;break;case x.RUNE:{if(s[a]=!1,u.next&&u.next.length>0)break;if(e.insert(u.out),!u.runes||u.runes.length===0){n[a]=[],u.next=new Uint32Array([u.out]);break}let l=[];if(u.runes.length===1&&(u.arg&O.FOLD_CASE)!==0){let f=u.runes[0];l.push(f,f);for(let C=q.simpleFold(f);C!==f;C=q.simpleFold(C))l.push(C,C);l.sort((C,D)=>C-D)}else for(let f=0;f<u.runes.length;f++)l.push(u.runes[f]);n[a]=l,u.next=new Uint32Array(Math.floor(l.length/2)+1).fill(u.out),u.op=x.RUNE;break}case x.RUNE1:{if(s[a]=!1,u.next&&u.next.length>0)break;e.insert(u.out);let l=[];if((u.arg&O.FOLD_CASE)!==0){let f=u.runes[0];l.push(f,f);for(let C=q.simpleFold(f);C!==f;C=q.simpleFold(C))l.push(C,C);l.sort((C,D)=>C-D)}else l.push(u.runes[0],u.runes[0]);n[a]=l,u.next=new Uint32Array(Math.floor(l.length/2)+1).fill(u.out),u.op=x.RUNE;break}case x.RUNE_ANY:if(s[a]=!1,u.next&&u.next.length>0)break;e.insert(u.out),n[a]=[0,q.MAX_RUNE],u.next=new Uint32Array([u.out]);break;case x.RUNE_ANY_NOT_NL:if(s[a]=!1,u.next&&u.next.length>0)break;e.insert(u.out),n[a]=[0,9,11,q.MAX_RUNE],u.next=new Uint32Array(Math.floor(n[a].length/2)+1).fill(u.out);break}return B};for(e.clear(),e.insert(r.start);!e.empty();)if(t.clear(),!i(e.next()))return null;for(let a=0;a<r.inst.length;a++)n[a]&&(r.inst[a].runes=n[a]);return r},Jg=(r,e)=>{for(let t=0;t<e.inst.length;t++){let n=e.inst[t];switch(n.op){case x.ALT:case x.ALT_MATCH:case x.RUNE:break;case x.CAPTURE:case x.EMPTY_WIDTH:case x.NOP:case x.MATCH:case x.FAIL:r.inst[t].next=null;break;case x.RUNE1:case x.RUNE_ANY:case x.RUNE_ANY_NOT_NL:r.inst[t].next=null,r.inst[t].op=n.op,r.inst[t].runes=n.runes?n.runes.slice():[];break}}},Mh=class pf{static compile(e){if(e.start===0||e.numLb>0)return null;let t=e.inst[e.start];if(t.op!==x.EMPTY_WIDTH||(t.arg&K.EMPTY_BEGIN_TEXT)===0)return null;let n=!1;for(let i=0;i<e.inst.length;i++)if(e.inst[i].op===x.ALT||e.inst[i].op===x.ALT_MATCH){n=!0;break}for(let i=0;i<e.inst.length;i++){let a=e.inst[i],B=e.inst[a.out].op;switch(a.op){case x.ALT:case x.ALT_MATCH:if(B===x.MATCH||e.inst[a.arg].op===x.MATCH)return null;break;case x.EMPTY_WIDTH:if(B===x.MATCH){if((a.arg&K.EMPTY_END_TEXT)===K.EMPTY_END_TEXT)continue;return null}break;default:if(B===x.MATCH&&n)return null;break}}let s=qg(e);return s=jg(s),s!==null&&Jg(s,e),s}static next(e,t){let n=e.matchRunePos(t);return n>=0?e.next[n]:e.op===x.ALT_MATCH?e.out:0}static execute(e,t,n,s,i){let a=e.onepass;if(!a)return null;let B=new Int32Array(i).fill(-1),u=!1,l=t.step(n),f=l>>3,C=l&7,D=je.EOF(),v=-1,R=0;l!==je.EOF()&&(D=t.step(n+C),D!==je.EOF()&&(v=D>>3,R=D&7));let V=n===0?K.emptyOpContext(-1,f):t.context(n),H=a.start,z;for(;;){switch(z=a.inst[H],H=z.out,z.op){case x.MATCH:return s===O.ANCHOR_BOTH&&n!==t.endPos()?null:(u=!0,B.length>0&&(B[0]=0,B[1]=n),i===0?[]:K.toArray(B));case x.RUNE:if(!z.matchRune(f))return null;break;case x.RUNE1:if(f!==z.runes[0])return null;break;case x.RUNE_ANY:break;case x.RUNE_ANY_NOT_NL:if(f===10)return null;break;case x.ALT:case x.ALT_MATCH:H=pf.next(z,f);continue;case x.FAIL:return null;case x.NOP:continue;case x.EMPTY_WIDTH:if((z.arg&~V)!==0)return null;continue;case x.CAPTURE:z.arg<B.length&&(B[z.arg]=n);continue;default:throw new Zr("bad inst")}if(C===0)break;V=K.emptyOpContext(f,v),n+=C,f=v,C=R,f!==-1&&(D=t.step(n+C),D!==je.EOF()?(v=D>>3,R=D&7):(v=-1,R=0))}return u?i===0?[]:K.toArray(B):null}},y=class W{static Op=cf(["NO_MATCH","EMPTY_MATCH","LITERAL","CHAR_CLASS","ANY_CHAR_NOT_NL","ANY_CHAR","BEGIN_LINE","END_LINE","BEGIN_TEXT","END_TEXT","WORD_BOUNDARY","NO_WORD_BOUNDARY","CAPTURE","STAR","PLUS","QUEST","REPEAT","CONCAT","ALTERNATE","PLB","NLB","LEFT_PAREN","VERTICAL_BAR"]);static isPseudoOp(e){return e>=W.Op.LEFT_PAREN}static emptySubs(){return[]}static quoteIfHyphen(e){return e===F.CODES.get("-")?"\\":""}static fromRegexp(e){let t=new W(e.op);return t.flags=e.flags,t.subs=e.subs,t.runes=e.runes,t.cap=e.cap,t.min=e.min,t.max=e.max,t.name=e.name,t.namedGroups=e.namedGroups,t.lb=e.lb,t}constructor(e){this.op=e,this.flags=0,this.subs=W.emptySubs(),this.runes=[],this.min=0,this.max=0,this.cap=0,this.name=null,this.namedGroups=Object.create(null),this.lb=0}reinit(){this.flags=0,this.subs=W.emptySubs(),this.runes=[],this.cap=0,this.min=0,this.max=0,this.name=null,this.namedGroups=Object.create(null),this.lb=0}toString(){return this.appendTo()}appendTo(){let e="";switch(this.op){case W.Op.NO_MATCH:e+="[^\\x00-\\x{10FFFF}]";break;case W.Op.EMPTY_MATCH:e+="(?:)";break;case W.Op.STAR:case W.Op.PLUS:case W.Op.QUEST:case W.Op.REPEAT:{let t=this.subs[0];switch(t.op>W.Op.CAPTURE||t.op===W.Op.LITERAL&&t.runes.length>1?e+=`(?:${t.appendTo()})`:e+=t.appendTo(),this.op){case W.Op.STAR:e+="*";break;case W.Op.PLUS:e+="+";break;case W.Op.QUEST:e+="?";break;case W.Op.REPEAT:e+=`{${this.min}`,this.min!==this.max&&(e+=",",this.max>=0&&(e+=this.max)),e+="}";break}(this.flags&O.NON_GREEDY)!==0&&(e+="?");break}case W.Op.CONCAT:for(let t of this.subs)t.op===W.Op.ALTERNATE?e+=`(?:${t.appendTo()})`:e+=t.appendTo();break;case W.Op.ALTERNATE:{let t="";for(let n of this.subs)e+=t,t="|",e+=n.appendTo();break}case W.Op.LITERAL:(this.flags&O.FOLD_CASE)!==0&&(e+="(?i:");for(let t of this.runes)e+=K.escapeRune(t);(this.flags&O.FOLD_CASE)!==0&&(e+=")");break;case W.Op.ANY_CHAR_NOT_NL:e+="(?-s:.)";break;case W.Op.ANY_CHAR:e+="(?s:.)";break;case W.Op.PLB:e+=`(?<=${this.subs[0].appendTo()})`;break;case W.Op.NLB:e+=`(?<!${this.subs[0].appendTo()})`;break;case W.Op.CAPTURE:this.name===null||this.name.length===0?e+="(":e+=`(?P<${this.name}>`,this.subs[0].op!==W.Op.EMPTY_MATCH&&(e+=this.subs[0].appendTo()),e+=")";break;case W.Op.BEGIN_TEXT:e+="\\A";break;case W.Op.END_TEXT:(this.flags&O.WAS_DOLLAR)!==0?e+="(?-m:$)":e+="\\z";break;case W.Op.BEGIN_LINE:e+="^";break;case W.Op.END_LINE:e+="$";break;case W.Op.WORD_BOUNDARY:e+="\\b";break;case W.Op.NO_WORD_BOUNDARY:e+="\\B";break;case W.Op.CHAR_CLASS:if(this.runes.length%2!==0){e+="[invalid char class]";break}if(e+="[",this.runes.length===0)e+="^\\x00-\\x{10FFFF}";else if(this.runes[0]===0&&this.runes[this.runes.length-1]===q.MAX_RUNE){e+="^";for(let t=1;t<this.runes.length-1;t+=2){let n=this.runes[t]+1,s=this.runes[t+1]-1;e+=W.quoteIfHyphen(n),e+=K.escapeRune(n),n!==s&&(e+="-",e+=W.quoteIfHyphen(s),e+=K.escapeRune(s))}}else for(let t=0;t<this.runes.length;t+=2){let n=this.runes[t],s=this.runes[t+1];e+=W.quoteIfHyphen(n),e+=K.escapeRune(n),n!==s&&(e+="-",e+=W.quoteIfHyphen(s),e+=K.escapeRune(s))}e+="]";break;default:e+=this.op;break}return e}maxCap(){let e=0;if(this.op===W.Op.CAPTURE&&(e=this.cap),this.subs!==null)for(let t of this.subs){let n=t.maxCap();e<n&&(e=n)}return e}equals(e){if(!(e!==null&&e instanceof W)||this.op!==e.op)return!1;switch(this.op){case W.Op.END_TEXT:if((this.flags&O.WAS_DOLLAR)!==(e.flags&O.WAS_DOLLAR))return!1;break;case W.Op.LITERAL:case W.Op.CHAR_CLASS:if(this.runes===null&&e.runes===null)break;if(this.runes===null||e.runes===null||this.runes.length!==e.runes.length)return!1;for(let t=0;t<this.runes.length;t++)if(this.runes[t]!==e.runes[t])return!1;break;case W.Op.ALTERNATE:case W.Op.CONCAT:if(this.subs.length!==e.subs.length)return!1;for(let t=0;t<this.subs.length;++t)if(!this.subs[t].equals(e.subs[t]))return!1;break;case W.Op.STAR:case W.Op.PLUS:case W.Op.QUEST:if((this.flags&O.NON_GREEDY)!==(e.flags&O.NON_GREEDY)||!this.subs[0].equals(e.subs[0]))return!1;break;case W.Op.REPEAT:if((this.flags&O.NON_GREEDY)!==(e.flags&O.NON_GREEDY)||this.min!==e.min||this.max!==e.max||!this.subs[0].equals(e.subs[0]))return!1;break;case W.Op.CAPTURE:if(this.cap!==e.cap||(this.name===null?e.name!==null:this.name!==e.name)||!this.subs[0].equals(e.subs[0]))return!1;break;case W.Op.PLB:case W.Op.NLB:if(this.lb!==e.lb||!this.subs[0].equals(e.subs[0]))return!1;break}return!0}},Gh=class{constructor(r){this.next=[Object.create(null)],this.fail=[0],this.match=[!1];for(let t of r){let n=0;for(let s=0;s<t.length;s++){let i=t[s];i in this.next[n]||(this.next.push(Object.create(null)),this.fail.push(0),this.match.push(!1),this.next[n][i]=this.next.length-1),n=this.next[n][i]}this.match[n]=!0}let e=[];for(let t in this.next[0])if(Object.prototype.hasOwnProperty.call(this.next[0],t)){let n=this.next[0][t];this.fail[n]=0,e.push(n)}for(;e.length>0;){let t=e.shift();for(let n in this.next[t])if(Object.prototype.hasOwnProperty.call(this.next[t],n)){let s=this.next[t][n],i=this.fail[t];for(;i!==0&&!(n in this.next[i]);)i=this.fail[i];n in this.next[i]?this.fail[s]=this.next[i][n]:this.fail[s]=0,this.match[s]=this.match[s]||this.match[this.fail[s]],e.push(s)}}}searchUTF16(r,e,t){let n=0;for(let s=e;s<t;s++){let i=r.charCodeAt(s);for(;n!==0&&!(i in this.next[n]);)n=this.fail[n];if(i in this.next[n]&&(n=this.next[n][i]),this.match[n])return!0}return!1}searchUTF8(r,e,t){let n=0;for(let s=e;s<t;s++){let i=r[s];for(;n!==0&&!(i in this.next[n]);)n=this.fail[n];if(i in this.next[n]&&(n=this.next[n][i]),this.match[n])return!0}return!1}},ue=class Xr{static Type={NONE:0,EXACT:1,AND:2,OR:3};constructor(e){this.type=e,this.subs=[],this.str="",this.bytes=null,this.ac16=null,this.ac8=null}eval(e,t){switch(this.type){case Xr.Type.NONE:return!0;case Xr.Type.EXACT:return e.hasString(this,t);case Xr.Type.AND:for(let n=0;n<this.subs.length;n++)if(!this.subs[n].eval(e,t))return!1;return!0;case Xr.Type.OR:if(this.ac16&&this.ac8)return e.hasAnyString(this,t);for(let n=0;n<this.subs.length;n++)if(this.subs[n].eval(e,t))return!0;return!1;default:return!0}}},Kg=class vt{static build(e){let t=vt.fromRegexp(e);return vt.simplify(t)}static fromRegexp(e){if(!e)return new ue(ue.Type.NONE);switch(e.op){case y.Op.PLB:case y.Op.NLB:case y.Op.NO_MATCH:case y.Op.EMPTY_MATCH:case y.Op.BEGIN_LINE:case y.Op.END_LINE:case y.Op.BEGIN_TEXT:case y.Op.END_TEXT:case y.Op.WORD_BOUNDARY:case y.Op.NO_WORD_BOUNDARY:case y.Op.CHAR_CLASS:case y.Op.ANY_CHAR_NOT_NL:case y.Op.ANY_CHAR:return new ue(ue.Type.NONE);case y.Op.LITERAL:{if(e.runes.length===0||(e.flags&O.FOLD_CASE)!==0)return new ue(ue.Type.NONE);let t=new ue(ue.Type.EXACT),n="";for(let s=0;s<e.runes.length;s++)n+=String.fromCodePoint(e.runes[s]);return t.str=n,t.bytes=K.stringToUtf8ByteArray(t.str),t}case y.Op.CAPTURE:case y.Op.PLUS:return vt.fromRegexp(e.subs[0]);case y.Op.REPEAT:return e.min>=1?vt.fromRegexp(e.subs[0]):new ue(ue.Type.NONE);case y.Op.CONCAT:{let t=new ue(ue.Type.AND);for(let n of e.subs)t.subs.push(vt.fromRegexp(n));return t}case y.Op.ALTERNATE:{let t=new ue(ue.Type.OR);for(let n of e.subs)t.subs.push(vt.fromRegexp(n));return t}default:return new ue(ue.Type.NONE)}}static simplify(e){if(e.type===ue.Type.EXACT||e.type===ue.Type.NONE)return e;if(e.type===ue.Type.AND){let t=[];for(let n of e.subs){let s=vt.simplify(n);if(s.type!==ue.Type.NONE)if(s.type===ue.Type.AND)for(let i=0;i<s.subs.length;i++)t.push(s.subs[i]);else t.push(s)}return t.length===0?new ue(ue.Type.NONE):t.length===1?t[0]:(e.subs=t,e)}if(e.type===ue.Type.OR){let t=[];for(let a of e.subs){let B=vt.simplify(a);if(B.type===ue.Type.NONE)return new ue(ue.Type.NONE);if(B.type===ue.Type.OR)for(let u=0;u<B.subs.length;u++)t.push(B.subs[u]);else t.push(B)}if(t.length===0)return new ue(ue.Type.NONE);if(t.length===1)return t[0];let n=new Set,s=[];for(let a of t)a.type===ue.Type.EXACT?n.has(a.str)||(n.add(a.str),s.push(a)):s.push(a);e.subs=s;let i=!0;for(let a of s)if(a.type!==ue.Type.EXACT){i=!1;break}return i&&s.length>1&&(e.ac16=new Gh(s.map(a=>{let B=[];for(let u=0;u<a.str.length;u++)B.push(a.str.charCodeAt(u));return B})),e.ac8=new Gh(s.map(a=>a.bytes))),e}return e}},ot=class{constructor(r=0,e=0){this.head=r,this.tail=e}},zg=class{constructor(){this.inst=[],this.start=0,this.numCap=2,this.lbStarts=[],this.numLb=0}getInst(r){return this.inst[r]}numInst(){return this.inst.length}addInst(r){this.inst.push(new x(r))}skipNop(r){let e=this.inst[r];for(;e.op===x.NOP||e.op===x.CAPTURE;)e=this.inst[r],r=e.out;return e}prefix(){let r="",e=this.skipNop(this.start);if(!x.isRuneOp(e.op)||e.runes.length!==1)return[e.op===x.MATCH,r];for(;x.isRuneOp(e.op)&&e.runes.length===1&&(e.arg&O.FOLD_CASE)===0;)r+=String.fromCodePoint(e.runes[0]),e=this.skipNop(e.out);return[e.op===x.MATCH,r]}startCond(){let r=0,e=this.start;e:for(;;){let t=this.inst[e];switch(t.op){case x.EMPTY_WIDTH:r|=t.arg;break;case x.FAIL:return-1;case x.CAPTURE:case x.NOP:break;default:break e}e=t.out}return r}patch(r,e){let t=r.head;for(;t!==0;){let n=this.inst[t>>1];(t&1)===0?(t=n.out,n.out=e):(t=n.arg,n.arg=e)}}append(r,e){if(r.head===0)return e;if(e.head===0)return r;let t=this.inst[r.tail>>1];return(r.tail&1)===0?t.out=e.head:t.arg=e.head,new ot(r.head,e.tail)}toString(){let r="";for(let e=0;e<this.inst.length;e++){let t=r.length;r+=e,e===this.start&&(r+="*"),r+="        ".substring(r.length-t),r+=this.inst[e],r+=`
`}return r}},yi=class{constructor(r=0,e=new ot,t=!1){this.i=r,this.out=e,this.nullable=t}},gf=class jn{static ANY_RUNE_NOT_NL(){return[0,F.CODES.get(`
`)-1,F.CODES.get(`
`)+1,q.MAX_RUNE]}static ANY_RUNE(){return[0,q.MAX_RUNE]}static compileRegexp(e){let t=new jn,n=t.compile(e);return t.prog.patch(n.out,t.newInst(x.MATCH).i),t.prog.start=n.i,t.prog}static compileSet(e){let t=new jn;if(e.length===0)return t.prog.start=t.newInst(x.FAIL).i,t.prog;let n=[];for(let i=0;i<e.length;i++){let a=t.compile(e[i]),B=t.newInst(x.MATCH);t.prog.getInst(B.i).arg=i,t.prog.patch(a.out,B.i),n.push(a.i)}let s=n[0];for(let i=1;i<n.length;i++){let a=t.newInst(x.ALT),B=t.prog.getInst(a.i);B.out=s,B.arg=n[i],s=a.i}return t.prog.start=s,t.prog}constructor(){this.prog=new zg,this.newInst(x.FAIL)}newInst(e){return this.prog.addInst(e),new yi(this.prog.numInst()-1,new ot,!0)}nop(){let e=this.newInst(x.NOP);return e.out=new ot(e.i<<1,e.i<<1),e}fail(){return new yi}cap(e){let t=this.newInst(x.CAPTURE);return t.out=new ot(t.i<<1,t.i<<1),this.prog.getInst(t.i).arg=e,this.prog.numCap<e+1&&(this.prog.numCap=e+1),t}cat(e,t){return e.i===0||t.i===0?this.fail():(this.prog.patch(e.out,t.i),new yi(e.i,t.out,e.nullable&&t.nullable))}alt(e,t){if(e.i===0)return t;if(t.i===0)return e;let n=this.newInst(x.ALT),s=this.prog.getInst(n.i);return s.out=e.i,s.arg=t.i,n.out=this.prog.append(e.out,t.out),n.nullable=e.nullable||t.nullable,n}loop(e,t){let n=this.newInst(x.ALT),s=this.prog.getInst(n.i);return t?(s.arg=e.i,n.out=new ot(n.i<<1,n.i<<1)):(s.out=e.i,n.out=new ot(n.i<<1|1,n.i<<1|1)),this.prog.patch(e.out,n.i),n}quest(e,t){let n=this.newInst(x.ALT),s=this.prog.getInst(n.i);return t?(s.arg=e.i,n.out=new ot(n.i<<1,n.i<<1)):(s.out=e.i,n.out=new ot(n.i<<1|1,n.i<<1|1)),n.out=this.prog.append(n.out,e.out),n}star(e,t){return e.nullable?this.quest(this.plus(e,t),t):this.loop(e,t)}plus(e,t){return new yi(e.i,this.loop(e,t).out,e.nullable)}empty(e){let t=this.newInst(x.EMPTY_WIDTH);return this.prog.getInst(t.i).arg=e,t.out=new ot(t.i<<1,t.i<<1),t}rune(e,t){let n=this.newInst(x.RUNE);n.nullable=!1;let s=this.prog.getInst(n.i);return s.runes=e,t&=O.FOLD_CASE,(e.length!==1||q.simpleFold(e[0])===e[0])&&(t&=~O.FOLD_CASE),s.arg=t,n.out=new ot(n.i<<1,n.i<<1),(t&O.FOLD_CASE)===0&&e.length===1||e.length===2&&e[0]===e[1]?s.op=x.RUNE1:e.length===2&&e[0]===0&&e[1]===q.MAX_RUNE?s.op=x.RUNE_ANY:e.length===4&&e[0]===0&&e[1]===F.CODES.get(`
`)-1&&e[2]===F.CODES.get(`
`)+1&&e[3]===q.MAX_RUNE&&(s.op=x.RUNE_ANY_NOT_NL),n}lookBehind(e,t){let n=this.newInst(x.LB_WRITE);this.prog.getInst(n.i).arg=t;let s=this.rune(jn.ANY_RUNE(),0),i=this.star(s,!0),a=this.cat(i,e);this.prog.patch(a.out,n.i);let B=this.newInst(x.LB_CHECK);return this.prog.getInst(B.i).arg=t,this.prog.lbStarts.push(a.i),Math.abs(t)>this.prog.numLb&&(this.prog.numLb=Math.abs(t)),B.out=new ot(B.i<<1,B.i<<1),B}compile(e){switch(e.op){case y.Op.NO_MATCH:return this.fail();case y.Op.EMPTY_MATCH:return this.nop();case y.Op.LITERAL:if(e.runes.length===0)return this.nop();{let t=null;for(let n of e.runes){let s=this.rune([n],e.flags);t=t===null?s:this.cat(t,s)}return t}case y.Op.CHAR_CLASS:return this.rune(e.runes,e.flags);case y.Op.ANY_CHAR_NOT_NL:return this.rune(jn.ANY_RUNE_NOT_NL(),0);case y.Op.ANY_CHAR:return this.rune(jn.ANY_RUNE(),0);case y.Op.BEGIN_LINE:return this.empty(K.EMPTY_BEGIN_LINE);case y.Op.END_LINE:return this.empty(K.EMPTY_END_LINE);case y.Op.BEGIN_TEXT:return this.empty(K.EMPTY_BEGIN_TEXT);case y.Op.END_TEXT:return this.empty(K.EMPTY_END_TEXT);case y.Op.WORD_BOUNDARY:return this.empty(K.EMPTY_WORD_BOUNDARY);case y.Op.NO_WORD_BOUNDARY:return this.empty(K.EMPTY_NO_WORD_BOUNDARY);case y.Op.PLB:case y.Op.NLB:return this.lookBehind(this.compile(e.subs[0]),e.lb);case y.Op.CAPTURE:{let t=this.cap(e.cap<<1),n=this.compile(e.subs[0]),s=this.cap(e.cap<<1|1);return this.cat(this.cat(t,n),s)}case y.Op.STAR:return this.star(this.compile(e.subs[0]),(e.flags&O.NON_GREEDY)!==0);case y.Op.PLUS:return this.plus(this.compile(e.subs[0]),(e.flags&O.NON_GREEDY)!==0);case y.Op.QUEST:return this.quest(this.compile(e.subs[0]),(e.flags&O.NON_GREEDY)!==0);case y.Op.CONCAT:if(e.subs.length===0)return this.nop();{let t=null;for(let n of e.subs){let s=this.compile(n);t=t===null?s:this.cat(t,s)}return t}case y.Op.ALTERNATE:if(e.subs.length===0)return this.nop();{let t=null;for(let n of e.subs){let s=this.compile(n);t=t===null?s:this.alt(t,s)}return t}default:throw new lf("regexp: unhandled case in compile")}}},mf=class et{static simplify(e){if(e===null)return null;switch(e.op){case y.Op.PLB:case y.Op.NLB:case y.Op.CAPTURE:{let t=et.simplify(e.subs[0]);if(t!==e.subs[0]){let n=y.fromRegexp(e);return n.runes=[],n.subs=[t],n}return e}case y.Op.CONCAT:case y.Op.ALTERNATE:{let t=[],n=!1;for(let s=0;s<e.subs.length;s++){let i=e.subs[s],a=et.simplify(i);if(a!==i&&(n=!0),e.op===y.Op.CONCAT){if(a.op===y.Op.NO_MATCH)return new y(y.Op.NO_MATCH);if(a.op===y.Op.EMPTY_MATCH){n=!0;continue}if(a.op===y.Op.CONCAT){n=!0;for(let B=0;B<a.subs.length;B++)t.push(a.subs[B]);continue}}else if(e.op===y.Op.ALTERNATE){if(a.op===y.Op.NO_MATCH){n=!0;continue}if(a.op===y.Op.ALTERNATE){n=!0;for(let B=0;B<a.subs.length;B++)t.push(a.subs[B]);continue}}t.push(a)}if(n){if(t.length===0)return new y(e.op===y.Op.CONCAT?y.Op.EMPTY_MATCH:y.Op.NO_MATCH);if(t.length===1)return t[0];let s=y.fromRegexp(e);return s.runes=[],s.subs=t,s}return e}case y.Op.CHAR_CLASS:return e.runes===null?e:e.runes.length===0?new y(y.Op.NO_MATCH):e.runes.length===2&&e.runes[0]===0&&e.runes[1]===q.MAX_RUNE?new y(y.Op.ANY_CHAR):e.runes.length===4&&e.runes[0]===0&&e.runes[1]===F.CODES.get(`
`)-1&&e.runes[2]===F.CODES.get(`
`)+1&&e.runes[3]===q.MAX_RUNE?new y(y.Op.ANY_CHAR_NOT_NL):e;case y.Op.STAR:case y.Op.PLUS:case y.Op.QUEST:{let t=et.simplify(e.subs[0]);return et.simplify1(e.op,e.flags,t,e)}case y.Op.REPEAT:{if(e.min===0&&e.max===0)return new y(y.Op.EMPTY_MATCH);let t=et.simplify(e.subs[0]);if(e.max===-1){if(e.min===0)return et.simplify1(y.Op.STAR,e.flags,t,null);if(e.min===1)return et.simplify1(y.Op.PLUS,e.flags,t,null);let s=new y(y.Op.CONCAT),i=[];for(let a=0;a<e.min-1;a++)i.push(t);return i.push(et.simplify1(y.Op.PLUS,e.flags,t,null)),s.subs=i.slice(0),et.simplify(s)}if(e.min===1&&e.max===1)return t;let n=null;if(e.min>0){n=[];for(let s=0;s<e.min;s++)n.push(t)}if(e.max>e.min){let s=et.simplify1(y.Op.QUEST,e.flags,t,null);for(let i=e.min+1;i<e.max;i++){let a=new y(y.Op.CONCAT);a.subs=[t,s],s=et.simplify1(y.Op.QUEST,e.flags,a,null)}if(n===null)return s;n.push(s)}if(n!==null){let s=new y(y.Op.CONCAT);return s.subs=n.slice(0),et.simplify(s)}return new y(y.Op.NO_MATCH)}}return e}static simplify1(e,t,n,s){if(n.op===y.Op.EMPTY_MATCH)return n;if(n.op===y.Op.NO_MATCH)return e===y.Op.PLUS?n:new y(y.Op.EMPTY_MATCH);if(e===n.op&&(t&O.NON_GREEDY)===(n.flags&O.NON_GREEDY))return n;if(s!==null&&s.op===e&&(s.flags&O.NON_GREEDY)===(t&O.NON_GREEDY)&&n===s.subs[0])return s;let i=new y(e);return i.flags=t,i.subs=[n],i}},oe=class{constructor(r,e){this.sign=r,this.cls=e}},Hh=[48,57],Uh=[9,10,12,13,32,32],qh=[48,57,65,90,95,95,97,122],jh=new Map([["\\d",new oe(1,Hh)],["\\D",new oe(-1,Hh)],["\\s",new oe(1,Uh)],["\\S",new oe(-1,Uh)],["\\w",new oe(1,qh)],["\\W",new oe(-1,qh)]]),Jh=[48,57,65,90,97,122],Kh=[65,90,97,122],zh=[0,127],Qh=[9,9,32,32],$h=[0,31,127,127],Wh=[48,57],Yh=[33,126],Xh=[97,122],Zh=[32,126],ef=[33,47,58,64,91,96,123,126],tf=[9,13,32,32],nf=[65,90],rf=[48,57,65,90,95,95,97,122],sf=[48,57,65,70,97,102],of=new Map([["[:alnum:]",new oe(1,Jh)],["[:^alnum:]",new oe(-1,Jh)],["[:alpha:]",new oe(1,Kh)],["[:^alpha:]",new oe(-1,Kh)],["[:ascii:]",new oe(1,zh)],["[:^ascii:]",new oe(-1,zh)],["[:blank:]",new oe(1,Qh)],["[:^blank:]",new oe(-1,Qh)],["[:cntrl:]",new oe(1,$h)],["[:^cntrl:]",new oe(-1,$h)],["[:digit:]",new oe(1,Wh)],["[:^digit:]",new oe(-1,Wh)],["[:graph:]",new oe(1,Yh)],["[:^graph:]",new oe(-1,Yh)],["[:lower:]",new oe(1,Xh)],["[:^lower:]",new oe(-1,Xh)],["[:print:]",new oe(1,Zh)],["[:^print:]",new oe(-1,Zh)],["[:punct:]",new oe(1,ef)],["[:^punct:]",new oe(-1,ef)],["[:space:]",new oe(1,tf)],["[:^space:]",new oe(-1,tf)],["[:upper:]",new oe(1,nf)],["[:^upper:]",new oe(-1,nf)],["[:word:]",new oe(1,rf)],["[:^word:]",new oe(-1,rf)],["[:xdigit:]",new oe(1,sf)],["[:^xdigit:]",new oe(-1,sf)]]),Qt=class $t{static charClassToString(e,t){let n="[";for(let s=0;s<t;s+=2){s>0&&(n+=" ");let i=e[s],a=e[s+1];i===a?n+=`0x${i.toString(16)}`:n+=`0x${i.toString(16)}-0x${a.toString(16)}`}return n+="]",n}static cmp(e,t,n,s){let i=e[t]-n;return i!==0?i:s-e[t+1]}static qsortIntPair(e,t,n){let s=((t+n)/2|0)&-2,i=e[s],a=e[s+1],B=t,u=n;for(;B<=u;){for(;B<n&&$t.cmp(e,B,i,a)<0;)B+=2;for(;u>t&&$t.cmp(e,u,i,a)>0;)u-=2;if(B<=u){if(B!==u){let l=e[B];e[B]=e[u],e[u]=l,l=e[B+1],e[B+1]=e[u+1],e[u+1]=l}B+=2,u-=2}}t<u&&$t.qsortIntPair(e,t,u),B<n&&$t.qsortIntPair(e,B,n)}constructor(e=K.emptyInts()){this.r=e,this.len=e.length}toArray(){return this.len===this.r.length?this.r:this.r.slice(0,this.len)}cleanClass(){if(this.len<4)return this;$t.qsortIntPair(this.r,0,this.len-2);let e=2;for(let t=2;t<this.len;t+=2){let n=this.r[t],s=this.r[t+1];if(n<=this.r[e-1]+1){s>this.r[e-1]&&(this.r[e-1]=s);continue}this.r[e]=n,this.r[e+1]=s,e+=2}return this.len=e,this}appendLiteral(e,t){return(t&O.FOLD_CASE)!==0?this.appendFoldedRange(e,e):this.appendRange(e,e)}appendRange(e,t){if(this.len>0){for(let n=2;n<=4;n+=2)if(this.len>=n){let s=this.r[this.len-n],i=this.r[this.len-n+1];if(e<=i+1&&s<=t+1)return e<s&&(this.r[this.len-n]=e),t>i&&(this.r[this.len-n+1]=t),this}}return this.r[this.len++]=e,this.r[this.len++]=t,this}appendFoldedRange(e,t){if(e<=q.MIN_FOLD&&t>=q.MAX_FOLD)return this.appendRange(e,t);if(t<q.MIN_FOLD||e>q.MAX_FOLD)return this.appendRange(e,t);e<q.MIN_FOLD&&(this.appendRange(e,q.MIN_FOLD-1),e=q.MIN_FOLD),t>q.MAX_FOLD&&(this.appendRange(q.MAX_FOLD+1,t),t=q.MAX_FOLD);for(let n=e;n<=t;n++){this.appendRange(n,n);for(let s=q.simpleFold(n);s!==n;s=q.simpleFold(s))this.appendRange(s,s)}return this}appendClass(e){for(let t=0;t<e.length;t+=2)this.appendRange(e[t],e[t+1]);return this}appendFoldedClass(e){for(let t=0;t<e.length;t+=2)this.appendFoldedRange(e[t],e[t+1]);return this}appendNegatedClass(e){let t=0;for(let n=0;n<e.length;n+=2){let s=e[n],i=e[n+1];t<=s-1&&this.appendRange(t,s-1),t=i+1}return t<=q.MAX_RUNE&&this.appendRange(t,q.MAX_RUNE),this}appendTable(e){for(let t=0;t<e.length;++t){let n=e.getLo(t),s=e.getHi(t),i=e.getStride(t);if(i===1){this.appendRange(n,s);continue}for(let a=n;a<=s;a+=i)this.appendRange(a,a)}return this}appendNegatedTable(e){let t=0;for(let n=0;n<e.length;++n){let s=e.getLo(n),i=e.getHi(n),a=e.getStride(n);if(a===1){t<=s-1&&this.appendRange(t,s-1),t=i+1;continue}for(let B=s;B<=i;B+=a)t<=B-1&&this.appendRange(t,B-1),t=B+1}return t<=q.MAX_RUNE&&this.appendRange(t,q.MAX_RUNE),this}appendTableWithSign(e,t){return t<0?this.appendNegatedTable(e):this.appendTable(e)}negateClass(){let e=0,t=0;for(let n=0;n<this.len;n+=2){let s=this.r[n],i=this.r[n+1];e<=s-1&&(this.r[t]=e,this.r[t+1]=s-1,t+=2),e=i+1}return this.len=t,e<=q.MAX_RUNE&&(this.r[this.len++]=e,this.r[this.len++]=q.MAX_RUNE),this}appendClassWithSign(e,t){return t<0?this.appendNegatedClass(e):this.appendClass(e)}appendGroup(e,t){let n=e.cls;return t&&(n=new $t().appendFoldedClass(n).cleanClass().toArray()),this.appendClassWithSign(n,e.sign)}toString(){return $t.charClassToString(this.r,this.len)}},Qg=class{constructor(r){this.str=r,this.position=0}pos(){return this.position}rewindTo(r){this.position=r}more(){return this.position<this.str.length}peek(){return this.str.codePointAt(this.position)}skip(r){this.position+=r}skipString(r){this.position+=r.length}pop(){let r=this.str.codePointAt(this.position);return this.position+=K.charCount(r),r}lookingAt(r){return this.str.startsWith(r,this.position)}rest(){return this.str.substring(this.position)}from(r){return this.str.substring(r,this.position)}toString(){return this.rest()}},Ef=class J{static ERR_INTERNAL_ERROR="regexp/syntax: internal error";static ERR_INVALID_CHAR_RANGE="invalid character class range";static ERR_INVALID_ESCAPE="invalid escape sequence";static ERR_INVALID_NAMED_CAPTURE="invalid named capture";static ERR_INVALID_PERL_OP="invalid or unsupported Perl syntax";static ERR_INVALID_REPEAT_OP="invalid nested repetition operator";static ERR_INVALID_REPEAT_SIZE="invalid repeat count";static ERR_MISSING_BRACKET="missing closing ]";static ERR_MISSING_PAREN="missing closing )";static ERR_MISSING_REPEAT_ARGUMENT="missing argument to repetition operator";static ERR_TRAILING_BACKSLASH="trailing backslash at end of expression";static ERR_DUPLICATE_NAMED_CAPTURE="duplicate capture group name";static ERR_UNEXPECTED_PAREN="unexpected )";static ERR_NESTING_DEPTH="expression nests too deeply";static ERR_LARGE="expression too large";static ERR_INVALID_CAPTURE_IN_LOOKBEHIND="invalid capture in lookbehind";static MAX_HEIGHT=1e3;static MAX_SIZE=3355443;static MAX_RUNES=33554432;static ANY_TABLE=new p(new Uint32Array([0,q.MAX_RUNE,1]));static ASCII_TABLE=new p(new Uint32Array([0,127,1]));static ASCII_FOLD_TABLE=new p(new Uint32Array([0,127,1,383,383,1,8490,8490,1]));static unicodeTable(e){return e==="Any"?{tab:J.ANY_TABLE,fold:J.ANY_TABLE,sign:1}:e==="Ascii"?{tab:J.ASCII_TABLE,fold:J.ASCII_FOLD_TABLE,sign:1}:e==="Assigned"?{tab:Qe.CATEGORIES.get("Cn"),fold:Qe.CATEGORIES.get("Cn"),sign:-1}:e==="Lc"?{tab:Qe.CATEGORIES.get("LC"),fold:Qe.FOLD_CATEGORIES.get("LC"),sign:1}:Qe.CATEGORIES.has(e)?{tab:Qe.CATEGORIES.get(e),fold:Qe.FOLD_CATEGORIES.get(e),sign:1}:Qe.SCRIPTS.has(e)?{tab:Qe.SCRIPTS.get(e),fold:Qe.FOLD_SCRIPT.get(e),sign:1}:null}static minFoldRune(e){if(e<q.MIN_FOLD||e>q.MAX_FOLD)return e;let t=e,n=e;for(e=q.simpleFold(e);e!==n;e=q.simpleFold(e))t>e&&(t=e);return t}static leadingRegexp(e){if(e.op===y.Op.EMPTY_MATCH)return null;if(e.op===y.Op.CONCAT&&e.subs.length>0){let t=e.subs[0];return t.op===y.Op.EMPTY_MATCH?null:t}return e}static literalRegexp(e,t){let n=new y(y.Op.LITERAL);return n.flags=t,n.runes=K.stringToRunes(e),n}static parse(e,t){return new J(e,t).parseInternal()}static parseRepeat(e){let t=e.pos();if(!e.more()||!e.lookingAt("{"))return-1;e.skip(1);let n=J.parseInt(e);if(n===-1||!e.more())return-1;let s;if(!e.lookingAt(","))s=n;else{if(e.skip(1),!e.more())return-1;if(e.lookingAt("}"))s=-1;else if((s=J.parseInt(e))===-1)return-1}if(!e.more()||!e.lookingAt("}"))return-1;if(e.skip(1),n<0||n>1e3||s===-2||s>1e3||s>=0&&n>s)throw new de(J.ERR_INVALID_REPEAT_SIZE,e.from(t));return n<<16|s&q.MAX_BMP}static isValidCaptureName(e){if(e.length===0)return!1;for(let t=0;t<e.length;t++){let n=e.codePointAt(t);if(n!==F.CODES.get("_")&&!K.isalnum(n))return!1}return!0}static parseInt(e){let t=e.pos();for(;e.more()&&e.peek()>=F.CODES.get("0")&&e.peek()<=F.CODES.get("9");)e.skip(1);let n=e.from(t);return n.length===0||n.length>1&&n.codePointAt(0)===F.CODES.get("0")?-1:n.length>8?-2:parseInt(n,10)}static isCharClass(e){return e.op===y.Op.LITERAL&&e.runes.length===1||e.op===y.Op.CHAR_CLASS||e.op===y.Op.ANY_CHAR_NOT_NL||e.op===y.Op.ANY_CHAR}static matchRune(e,t){switch(e.op){case y.Op.LITERAL:return e.runes.length===1&&e.runes[0]===t;case y.Op.CHAR_CLASS:for(let n=0;n<e.runes.length;n+=2)if(e.runes[n]<=t&&t<=e.runes[n+1])return!0;return!1;case y.Op.ANY_CHAR_NOT_NL:return t!==F.CODES.get(`
`);case y.Op.ANY_CHAR:return!0}return!1}static mergeCharClass(e,t){switch(e.op){case y.Op.ANY_CHAR:break;case y.Op.ANY_CHAR_NOT_NL:J.matchRune(t,F.CODES.get(`
`))&&(e.op=y.Op.ANY_CHAR);break;case y.Op.CHAR_CLASS:t.op===y.Op.LITERAL?e.runes=new Qt(e.runes).appendLiteral(t.runes[0],t.flags).toArray():e.runes=new Qt(e.runes).appendClass(t.runes).toArray();break;case y.Op.LITERAL:if(t.runes[0]===e.runes[0]&&t.flags===e.flags)break;e.op=y.Op.CHAR_CLASS,e.runes=new Qt().appendLiteral(e.runes[0],e.flags).appendLiteral(t.runes[0],t.flags).toArray();break}}static parseEscape(e){let t=e.pos();if(e.skip(1),!e.more())throw new de(J.ERR_TRAILING_BACKSLASH);let n=e.pop();e:switch(n){case F.CODES.get("1"):case F.CODES.get("2"):case F.CODES.get("3"):case F.CODES.get("4"):case F.CODES.get("5"):case F.CODES.get("6"):case F.CODES.get("7"):if(!e.more()||e.peek()<F.CODES.get("0")||e.peek()>F.CODES.get("7"))break;case F.CODES.get("0"):{let s=n-F.CODES.get("0");for(let i=1;i<3&&!(!e.more()||e.peek()<F.CODES.get("0")||e.peek()>F.CODES.get("7"));i++)s=s*8+e.peek()-F.CODES.get("0"),e.skip(1);return s}case F.CODES.get("x"):{if(!e.more())break;if(n=e.pop(),n===F.CODES.get("{")){let a=0,B=0;for(;;){if(!e.more())break e;if(n=e.pop(),n===F.CODES.get("}"))break;let u=K.unhex(n);if(u<0||(B=B*16+u,B>q.MAX_RUNE))break e;a++}if(a===0)break e;return B}let s=K.unhex(n);if(!e.more())break;n=e.pop();let i=K.unhex(n);if(s<0||i<0)break;return s*16+i}case F.CODES.get("a"):return F.CODES.get("\x07");case F.CODES.get("f"):return F.CODES.get("\f");case F.CODES.get("n"):return F.CODES.get(`
`);case F.CODES.get("r"):return F.CODES.get("\r");case F.CODES.get("t"):return F.CODES.get("	");case F.CODES.get("v"):return F.CODES.get("\v");default:if(n<=q.MAX_ASCII&&!K.isalnum(n))return n;break}throw new de(J.ERR_INVALID_ESCAPE,e.from(t))}static parseClassChar(e,t){if(!e.more())throw new de(J.ERR_MISSING_BRACKET,e.from(t));return e.lookingAt("\\")?J.parseEscape(e):e.pop()}static concatRunes(e,t){for(let n=0;n<t.length;n++)e.push(t[n]);return e}static hasCapture(e){if(e===null)return!1;if(e.op===y.Op.CAPTURE)return!0;if(e.subs){for(let t of e.subs)if(J.hasCapture(t))return!0}return!1}constructor(e,t=0){this.wholeRegexp=e,this.flags=t,this.numCap=0,this.namedGroups=Object.create(null),this.stack=[],this.free=null,this.numRegexp=0,this.numRunes=0,this.repeats=0,this.height=null,this.size=null,this.nlb=0}newRegexp(e){let t=this.free;return t!==null&&t.subs!==null&&t.subs.length>0?(this.free=t.subs[0],t.reinit(),t.op=e):(t=new y(e),this.numRegexp+=1),t}reuse(e){this.height!==null&&this.height.has(e)&&this.height.delete(e),e.subs!==null&&e.subs.length>0&&(e.subs[0]=this.free),this.free=e}checkLimits(e){if(this.numRunes>J.MAX_RUNES)throw new de(J.ERR_LARGE);this.checkSize(e),this.checkHeight(e)}checkSize(e){if(this.size===null){if(this.repeats===0&&(this.repeats=1),e.op===y.Op.REPEAT){let t=e.max;t===-1&&(t=e.min),t<=0&&(t=1),t>Math.floor(J.MAX_SIZE/this.repeats)?this.repeats=J.MAX_SIZE:this.repeats*=t}if(this.numRegexp<Math.floor(J.MAX_SIZE/this.repeats))return;this.size=new Map;for(let t of this.stack)this.checkSize(t)}if(this.calcSize(e,!0)>J.MAX_SIZE)throw new de(J.ERR_LARGE)}calcSize(e,t=!1){if(!t&&this.size!==null&&this.size.has(e))return this.size.get(e);let n=0;switch(e.op){case y.Op.LITERAL:n=e.runes.length;break;case y.Op.PLB:case y.Op.NLB:case y.Op.CAPTURE:case y.Op.STAR:n=2+this.calcSize(e.subs[0]);break;case y.Op.PLUS:case y.Op.QUEST:n=1+this.calcSize(e.subs[0]);break;case y.Op.CONCAT:for(let s of e.subs)n=n+this.calcSize(s);break;case y.Op.ALTERNATE:for(let s of e.subs)n=n+this.calcSize(s);e.subs.length>1&&(n=n+e.subs.length-1);break;case y.Op.REPEAT:{let s=this.calcSize(e.subs[0]);if(e.max===-1){e.min===0?n=2+s:n=1+e.min*s;break}n=e.max*s+(e.max-e.min);break}}return n=Math.max(1,n),this.size===null&&(this.size=new Map),this.size.set(e,n),n}checkHeight(e){if(!(this.numRegexp<J.MAX_HEIGHT)){if(this.height===null){this.height=new Map;for(let t of this.stack)this.checkHeight(t)}if(this.calcHeight(e,!0)>J.MAX_HEIGHT)throw new de(J.ERR_NESTING_DEPTH)}}calcHeight(e,t=!1){if(!t&&this.height!==null&&this.height.has(e))return this.height.get(e);let n=1;for(let s of e.subs){let i=this.calcHeight(s);n<1+i&&(n=1+i)}return this.height===null&&(this.height=new Map),this.height.set(e,n),n}pop(){return this.stack.pop()}popToPseudo(){let e=this.stack.length,t=e;for(;t>0&&!y.isPseudoOp(this.stack[t-1].op);)t--;let n=this.stack.slice(t,e);return this.stack=this.stack.slice(0,t),n}push(e){if(this.numRunes+=e.runes.length,e.op===y.Op.CHAR_CLASS&&e.runes.length===2&&e.runes[0]===e.runes[1]){if(this.maybeConcat(e.runes[0],this.flags&~O.FOLD_CASE))return null;e.op=y.Op.LITERAL,e.runes=[e.runes[0]],e.flags=this.flags&~O.FOLD_CASE}else if(e.op===y.Op.CHAR_CLASS&&e.runes.length===4&&e.runes[0]===e.runes[1]&&e.runes[2]===e.runes[3]&&q.simpleFold(e.runes[0])===e.runes[2]&&q.simpleFold(e.runes[2])===e.runes[0]||e.op===y.Op.CHAR_CLASS&&e.runes.length===2&&e.runes[0]+1===e.runes[1]&&q.simpleFold(e.runes[0])===e.runes[1]&&q.simpleFold(e.runes[1])===e.runes[0]){if(this.maybeConcat(e.runes[0],this.flags|O.FOLD_CASE))return null;e.op=y.Op.LITERAL,e.runes=[e.runes[0]],e.flags=this.flags|O.FOLD_CASE}else this.maybeConcat(-1,0);return this.stack.push(e),this.checkLimits(e),e}maybeConcat(e,t){let n=this.stack.length;if(n<2)return!1;let s=this.stack[n-1],i=this.stack[n-2];return s.op!==y.Op.LITERAL||i.op!==y.Op.LITERAL||(s.flags&O.FOLD_CASE)!==(i.flags&O.FOLD_CASE)?!1:(i.runes=J.concatRunes(i.runes,s.runes),e>=0?(s.runes=[e],s.flags=t,!0):(this.pop(),this.reuse(s),!1))}newLiteral(e,t){let n=this.newRegexp(y.Op.LITERAL);return n.flags=t,(t&O.FOLD_CASE)!==0&&(e=J.minFoldRune(e)),n.runes=[e],n}literal(e){this.push(this.newLiteral(e,this.flags))}op(e){let t=this.newRegexp(e);return t.flags=this.flags,this.push(t)}repeat(e,t,n,s,i,a){let B=this.flags;if((B&O.PERL_X)!==0&&(i.more()&&i.lookingAt("?")&&(i.skip(1),B^=O.NON_GREEDY),a!==-1))throw new de(J.ERR_INVALID_REPEAT_OP,i.from(a));let u=this.stack.length;if(u===0)throw new de(J.ERR_MISSING_REPEAT_ARGUMENT,i.from(s));let l=this.stack[u-1];if(y.isPseudoOp(l.op))throw new de(J.ERR_MISSING_REPEAT_ARGUMENT,i.from(s));let f=this.newRegexp(e);if(f.min=t,f.max=n,f.flags=B,f.subs=[l],this.stack[u-1]=f,this.checkLimits(f),e===y.Op.REPEAT&&(t>=2||n>=2)&&!this.repeatIsValid(f,1e3))throw new de(J.ERR_INVALID_REPEAT_SIZE,i.from(s))}repeatIsValid(e,t){if(e.op===y.Op.REPEAT){let n=e.max;if(n===0)return!0;if(n<0&&(n=e.min),n>t)return!1;n>0&&(t=Math.trunc(t/n))}for(let n of e.subs)if(!this.repeatIsValid(n,t))return!1;return!0}concat(){this.maybeConcat(-1,0);let e=this.popToPseudo();return e.length===0?this.push(this.newRegexp(y.Op.EMPTY_MATCH)):this.push(this.collapse(e,y.Op.CONCAT))}alternate(){let e=this.popToPseudo();return e.length>0&&this.cleanAlt(e[e.length-1]),e.length===0?this.push(this.newRegexp(y.Op.NO_MATCH)):this.push(this.collapse(e,y.Op.ALTERNATE))}cleanAlt(e){e.op===y.Op.CHAR_CLASS&&(e.runes=new Qt(e.runes).cleanClass().toArray(),e.runes.length===2&&e.runes[0]===0&&e.runes[1]===q.MAX_RUNE?(e.runes=[],e.op=y.Op.ANY_CHAR):e.runes.length===4&&e.runes[0]===0&&e.runes[1]===F.CODES.get(`
`)-1&&e.runes[2]===F.CODES.get(`
`)+1&&e.runes[3]===q.MAX_RUNE&&(e.runes=[],e.op=y.Op.ANY_CHAR_NOT_NL))}collapse(e,t){if(e.length===1)return e[0];let n=0;for(let B of e)n+=B.op===t?B.subs.length:1;let s=new Array(n).fill(null),i=0;for(let B of e)if(B.op===t){for(let u=0;u<B.subs.length;u++)s[i++]=B.subs[u];this.reuse(B)}else s[i++]=B;let a=this.newRegexp(t);if(a.subs=s,t===y.Op.ALTERNATE&&(a.subs=this.factor(a.subs),a.subs.length===1)){let B=a;a=a.subs[0],this.reuse(B)}return a}factor(e){if(e.length<2)return e;let t=0,n=e.length,s=0,i=null,a=0,B=0,u=0;for(let f=0;f<=n;f++){let C=null,D=0,v=0;if(f<n){let R=e[t+f];if(R.op===y.Op.CONCAT&&R.subs.length>0&&(R=R.subs[0]),R.op===y.Op.LITERAL&&(C=R.runes,D=R.runes.length,v=R.flags&O.FOLD_CASE),v===B){let V=0;for(;V<a&&V<D&&i[V]===C[V];)V++;if(V>0){a=V;continue}}}if(f!==u)if(f===u+1)e[s++]=e[t+u];else{let R=this.newRegexp(y.Op.LITERAL);R.flags=B,R.runes=i.slice(0,a);for(let z=u;z<f;z++)e[t+z]=this.removeLeadingString(e[t+z],a),this.checkLimits(e[t+z]);let V=this.collapse(e.slice(t+u,t+f),y.Op.ALTERNATE),H=this.newRegexp(y.Op.CONCAT);H.subs=[R,V],e[s++]=H}u=f,i=C,a=D,B=v}n=s,t=0,u=0,s=0;let l=null;for(let f=0;f<=n;f++){let C=null;if(!(f<n&&(C=J.leadingRegexp(e[t+f]),l!==null&&l.equals(C)&&(J.isCharClass(l)||l.op===y.Op.REPEAT&&l.min===l.max&&J.isCharClass(l.subs[0]))))){if(f!==u)if(f===u+1)e[s++]=e[t+u];else{let D=l;for(let V=u;V<f;V++){let H=V!==u;e[t+V]=this.removeLeadingRegexp(e[t+V],H),this.checkLimits(e[t+V])}let v=this.collapse(e.slice(t+u,t+f),y.Op.ALTERNATE),R=this.newRegexp(y.Op.CONCAT);R.subs=[D,v],e[s++]=R}u=f,l=C}}n=s,t=0,u=0,s=0;for(let f=0;f<=n;f++)if(!(f<n&&J.isCharClass(e[t+f]))){if(f!==u)if(f===u+1)e[s++]=e[t+u];else{let C=u;for(let v=u+1;v<f;v++){let R=e[t+C],V=e[t+v];(R.op<V.op||R.op===V.op&&(R.runes!==null?R.runes.length:0)<(V.runes!==null?V.runes.length:0))&&(C=v)}let D=e[t+u];e[t+u]=e[t+C],e[t+C]=D;for(let v=u+1;v<f;v++)J.mergeCharClass(e[t+u],e[t+v]),this.reuse(e[t+v]);this.cleanAlt(e[t+u]),e[s++]=e[t+u]}f<n&&(e[s++]=e[t+f]),u=f+1}n=s,t=0,u=0,s=0;for(let f=0;f<n;++f)f+1<n&&e[t+f].op===y.Op.EMPTY_MATCH&&e[t+f+1].op===y.Op.EMPTY_MATCH||(e[s++]=e[t+f]);return n=s,t=0,e.slice(t,n)}removeLeadingString(e,t){if(e.op===y.Op.CONCAT&&e.subs.length>0){let n=this.removeLeadingString(e.subs[0],t);if(e.subs[0]=n,n.op===y.Op.EMPTY_MATCH)switch(this.reuse(n),e.subs.length){case 0:case 1:e.op=y.Op.EMPTY_MATCH,e.subs=y.emptySubs();break;case 2:{let s=e;e=e.subs[1],this.reuse(s);break}default:e.subs=e.subs.slice(1,e.subs.length);break}return e}return e.op===y.Op.LITERAL&&(e.runes=e.runes.slice(t,e.runes.length),e.runes.length===0&&(e.op=y.Op.EMPTY_MATCH)),e}removeLeadingRegexp(e,t){if(e.op===y.Op.CONCAT&&e.subs.length>0){switch(t&&this.reuse(e.subs[0]),e.subs=e.subs.slice(1,e.subs.length),e.subs.length){case 0:e.op=y.Op.EMPTY_MATCH,e.subs=y.emptySubs();break;case 1:{let n=e;e=e.subs[0],this.reuse(n);break}}return e}return t&&this.reuse(e),this.newRegexp(y.Op.EMPTY_MATCH)}parseInternal(){if((this.flags&O.LITERAL)!==0)return J.literalRegexp(this.wholeRegexp,this.flags);let e=-1,t=-1,n=-1,s=new Qg(this.wholeRegexp);for(;s.more();){let i=-1;e:switch(s.peek()){case F.CODES.get("("):if((this.flags&O.LOOKBEHIND)!==0){if(s.lookingAt("(?<=")){this.parsePosLookBehind(),s.skip(4);break}if(s.lookingAt("(?<!")){this.parseNegLookBehind(),s.skip(4);break}}if((this.flags&O.PERL_X)!==0&&s.lookingAt("(?")){this.parsePerlFlags(s);break}this.op(y.Op.LEFT_PAREN).cap=++this.numCap,s.skip(1);break;case F.CODES.get("|"):this.parseVerticalBar(),s.skip(1);break;case F.CODES.get(")"):this.parseRightParen(),s.skip(1);break;case F.CODES.get("^"):(this.flags&O.ONE_LINE)!==0?this.op(y.Op.BEGIN_TEXT):this.op(y.Op.BEGIN_LINE),s.skip(1);break;case F.CODES.get("$"):(this.flags&O.ONE_LINE)!==0?this.op(y.Op.END_TEXT).flags|=O.WAS_DOLLAR:this.op(y.Op.END_LINE),s.skip(1);break;case F.CODES.get("."):(this.flags&O.DOT_NL)!==0?this.op(y.Op.ANY_CHAR):this.op(y.Op.ANY_CHAR_NOT_NL),s.skip(1);break;case F.CODES.get("["):this.parseClass(s);break;case F.CODES.get("*"):case F.CODES.get("+"):case F.CODES.get("?"):{i=s.pos();let a=null;switch(s.pop()){case F.CODES.get("*"):a=y.Op.STAR;break;case F.CODES.get("+"):a=y.Op.PLUS;break;case F.CODES.get("?"):a=y.Op.QUEST;break}this.repeat(a,t,n,i,s,e);break}case F.CODES.get("{"):{i=s.pos();let a=J.parseRepeat(s);if(a<0){s.rewindTo(i),this.literal(s.pop());break}t=a>>16,n=(a&q.MAX_BMP)<<16>>16,this.repeat(y.Op.REPEAT,t,n,i,s,e);break}case F.CODES.get("\\"):{let a=s.pos();if(s.skip(1),(this.flags&O.PERL_X)!==0&&s.more())switch(s.pop()){case F.CODES.get("A"):this.op(y.Op.BEGIN_TEXT);break e;case F.CODES.get("b"):this.op(y.Op.WORD_BOUNDARY);break e;case F.CODES.get("B"):this.op(y.Op.NO_WORD_BOUNDARY);break e;case F.CODES.get("C"):throw new de(J.ERR_INVALID_ESCAPE,"\\C");case F.CODES.get("Q"):{let l=s.rest(),f=l.indexOf("\\E");f>=0?(l=l.substring(0,f),s.skipString(l),s.skipString("\\E")):s.skipString(l);let C=0;for(;C<l.length;){let D=l.codePointAt(C);this.literal(D),C+=K.charCount(D)}break e}case F.CODES.get("z"):this.op(y.Op.END_TEXT);break e;default:s.rewindTo(a);break}else s.rewindTo(a);let B=this.newRegexp(y.Op.CHAR_CLASS);if(B.flags=this.flags,s.lookingAt("\\p")||s.lookingAt("\\P")){let l=new Qt;if(this.parseUnicodeClass(s,l)){B.runes=l.toArray(),this.push(B);break e}}let u=new Qt;if(this.parsePerlClassEscape(s,u)){B.runes=u.toArray(),this.push(B);break e}s.rewindTo(a),this.reuse(B),this.literal(J.parseEscape(s));break}default:this.literal(s.pop());break}e=i}if(this.concat(),this.swapVerticalBar()&&this.pop(),this.alternate(),this.stack.length!==1)throw new de(J.ERR_MISSING_PAREN,this.wholeRegexp);return this.stack[0].namedGroups=this.namedGroups,this.stack[0]}parsePerlFlags(e){let t=e.pos(),n=e.rest();if(n.startsWith("(?P<")||n.startsWith("(?<")){let B=n.charAt(2)==="P"?4:3,u=n.indexOf(">");if(u<0)throw new de(J.ERR_INVALID_NAMED_CAPTURE,n);let l=n.substring(B,u);if(e.skipString(l),e.skip(B+1),!J.isValidCaptureName(l))throw new de(J.ERR_INVALID_NAMED_CAPTURE,n.substring(0,u+1));let f=this.op(y.Op.LEFT_PAREN);if(f.cap=++this.numCap,this.namedGroups[l])throw new de(J.ERR_DUPLICATE_NAMED_CAPTURE,l);this.namedGroups[l]=this.numCap,f.name=l;return}e.skip(2);let s=this.flags,i=1,a=!1;e:for(;e.more();){let B=e.pop();switch(B){case F.CODES.get("i"):s|=O.FOLD_CASE,a=!0;break;case F.CODES.get("m"):s&=~O.ONE_LINE,a=!0;break;case F.CODES.get("s"):s|=O.DOT_NL,a=!0;break;case F.CODES.get("U"):s|=O.NON_GREEDY,a=!0;break;case F.CODES.get("-"):if(i<0)break e;i=-1,s=~s,a=!1;break;case F.CODES.get(":"):case F.CODES.get(")"):if(i<0){if(!a)break e;s=~s}B===F.CODES.get(":")&&this.op(y.Op.LEFT_PAREN),this.flags=s;return;default:break e}}throw new de(J.ERR_INVALID_PERL_OP,e.from(t))}parsePosLookBehind(){let e=this.newRegexp(y.Op.LEFT_PAREN);return e.flags=this.flags,e.lb=++this.nlb,this.push(e)}parseNegLookBehind(){let e=this.newRegexp(y.Op.LEFT_PAREN);return e.flags=this.flags,e.lb=-++this.nlb,this.push(e)}parseVerticalBar(){this.concat(),this.swapVerticalBar()||this.op(y.Op.VERTICAL_BAR)}swapVerticalBar(){let e=this.stack.length;if(e>=3&&this.stack[e-2].op===y.Op.VERTICAL_BAR&&J.isCharClass(this.stack[e-1])&&J.isCharClass(this.stack[e-3])){let t=this.stack[e-1],n=this.stack[e-3];if(t.op>n.op){let s=n;n=t,t=s,this.stack[e-3]=n}return J.mergeCharClass(n,t),this.reuse(t),this.pop(),!0}if(e>=2){let t=this.stack[e-1],n=this.stack[e-2];if(n.op===y.Op.VERTICAL_BAR)return e>=3&&this.cleanAlt(this.stack[e-3]),this.stack[e-2]=t,this.stack[e-1]=n,!0}return!1}parseRightParen(){if(this.concat(),this.swapVerticalBar()&&this.pop(),this.alternate(),this.stack.length<2)throw new de(J.ERR_UNEXPECTED_PAREN,this.wholeRegexp);let e=this.pop(),t=this.pop();if(t.op!==y.Op.LEFT_PAREN)throw new de(J.ERR_UNEXPECTED_PAREN,this.wholeRegexp);if(this.flags=t.flags,t.lb!==0){if(J.hasCapture(e))throw new de(J.ERR_INVALID_CAPTURE_IN_LOOKBEHIND,this.wholeRegexp);t.lb>0?t.op=y.Op.PLB:t.op=y.Op.NLB,t.subs=[e],this.push(t);return}t.cap===0?this.push(e):(t.op=y.Op.CAPTURE,t.subs=[e],this.push(t))}parsePerlClassEscape(e,t){let n=e.pos();if((this.flags&O.PERL_X)===0||!e.more()||e.pop()!==F.CODES.get("\\")||!e.more())return!1;e.pop();let s=e.from(n),i=jh.has(s)?jh.get(s):null;return i===null?!1:(t.appendGroup(i,(this.flags&O.FOLD_CASE)!==0),!0)}parseNamedClass(e,t){let n=e.rest(),s=n.indexOf(":]");if(s<0)return!1;let i=n.substring(0,s+2);e.skipString(i);let a=of.has(i)?of.get(i):null;if(a===null)throw new de(J.ERR_INVALID_CHAR_RANGE,i);return t.appendGroup(a,(this.flags&O.FOLD_CASE)!==0),!0}parseUnicodeClass(e,t){let n=e.pos();if((this.flags&O.UNICODE_GROUPS)===0||!e.lookingAt("\\p")&&!e.lookingAt("\\P"))return!1;e.skip(1);let s=1,i=e.pop();if(i===F.CODES.get("P")&&(s=-1),!e.more())throw e.rewindTo(n),new de(J.ERR_INVALID_CHAR_RANGE,e.rest());i=e.pop();let a;if(i!==F.CODES.get("{"))a=K.runeToString(i);else{let f=e.rest(),C=f.indexOf("}");if(C<0)throw e.rewindTo(n),new de(J.ERR_INVALID_CHAR_RANGE,e.rest());a=f.substring(0,C),e.skipString(a),e.skip(1)}a.length!==0&&a.codePointAt(0)===F.CODES.get("^")&&(s=0-s,a=a.substring(1));let B=J.unicodeTable(a);if(B===null)throw new de(J.ERR_INVALID_CHAR_RANGE,e.from(n));B.sign<0&&(s=0-s);let u=B.tab,l=B.fold;if((this.flags&O.FOLD_CASE)===0||l===null)t.appendTableWithSign(u,s);else{let f=new Qt().appendTable(u).appendTable(l).cleanClass().toArray();t.appendClassWithSign(f,s)}return!0}parseClass(e){let t=e.pos();e.skip(1);let n=this.newRegexp(y.Op.CHAR_CLASS);n.flags=this.flags;let s=new Qt,i=1;e.more()&&e.lookingAt("^")&&(i=-1,e.skip(1),(this.flags&O.CLASS_NL)===0&&s.appendRange(F.CODES.get(`
`),F.CODES.get(`
`)));let a=!0;for(;!e.more()||e.peek()!==F.CODES.get("]")||a;){if(e.more()&&e.lookingAt("-")&&(this.flags&O.PERL_X)===0&&!a){let f=e.rest();if(f==="-"||!f.startsWith("-]"))throw e.rewindTo(t),new de(J.ERR_INVALID_CHAR_RANGE,e.rest())}a=!1;let B=e.pos();if(e.lookingAt("[:")){if(this.parseNamedClass(e,s))continue;e.rewindTo(B)}if(this.parseUnicodeClass(e,s)||this.parsePerlClassEscape(e,s))continue;e.rewindTo(B);let u=J.parseClassChar(e,t),l=u;if(e.more()&&e.lookingAt("-")){if(e.skip(1),e.more()&&e.lookingAt("]"))e.skip(-1);else if(l=J.parseClassChar(e,t),l<u)throw new de(J.ERR_INVALID_CHAR_RANGE,e.from(B))}(this.flags&O.FOLD_CASE)===0?s.appendRange(u,l):s.appendFoldedRange(u,l)}e.skip(1),s.cleanClass(),i<0&&s.negateClass(),n.runes=s.toArray(),this.push(n)}},$g=class mn{static initTest(e){let t=mn.compile(e),n=new mn(t.expr,t.prog,t.numSubexp,t.longest);return n.cond=t.cond,n.prefix=t.prefix,n.prefixUTF8=t.prefixUTF8,n.prefixComplete=t.prefixComplete,n.prefixRune=t.prefixRune,n.prefilter=t.prefilter,n}static compile(e){return mn.compileImpl(e,O.PERL,!1)}static compilePOSIX(e){return mn.compileImpl(e,O.POSIX,!0)}static compileImpl(e,t,n){let s=Ef.parse(e,t),i=s.maxCap();s=mf.simplify(s);let a=Kg.build(s),B=gf.compileRegexp(s),u=new mn(e,B,i,n);u.prefilter=a.type===ue.Type.NONE?null:a;let[l,f]=B.prefix();return u.prefixComplete=l,u.prefix=f,u.prefixUTF8=K.stringToUtf8ByteArray(u.prefix),u.prefix.length>0&&(u.prefixRune=u.prefix.codePointAt(0)),u.namedGroups=s.namedGroups,u}static match(e,t){return mn.compile(e).match(t)}constructor(e,t,n=0,s=0){this.expr=e,this.prog=t,this.numSubexp=n,this.longest=s,this.cond=t.startCond(),this.prefix=null,this.prefixUTF8=null,this.prefixComplete=!1,this.prefixRune=0,this.machinePool=[],this.dfa=new df(this.prog),this.onepass=Mh.compile(this.prog),this.prefilter=null}matchPrefixComplete(e,t,n,s){if((n===O.ANCHOR_START||n===O.ANCHOR_BOTH)&&t!==0)return null;let i=-1,a=-1,B=e.prefixLength(this);if(n===O.UNANCHORED){let u=e.index(this,t);if(u<0)return null;i=t+u,a=i+B}else if(n===O.ANCHOR_BOTH){if(e.endPos()!==B||e.index(this,0)!==0)return null;i=0,a=B}else if(n===O.ANCHOR_START){if(e.index(this,0)!==0)return null;i=0,a=B}if(i<0)return null;if(s>0){let u=new Int32Array(s).fill(-1);return u[0]=i,u[1]=a,Array.from(u)}return[]}executeEngine(e,t,n,s){if(this.prefixComplete&&(s===0||this.numSubexp===0))return this.matchPrefixComplete(e,t,n,s);if(this.prefilter!==null&&n===O.UNANCHORED&&!this.prefilter.eval(e,t))return null;if(this.onepass!==null)return Mh.execute(this,e,t,n,s);if(s>0)return this.prog.numLb===0&&e.endPos()<=Di.maxBitStateLen(this.prog)?Di.execute(this,e,t,n,s):this.doExecuteNFA(e,t,n,s);if(this.prog.numLb===0){let i=this.dfa.match(e,t,n);if(i!==null)return i?[]:null;if(e.endPos()<=Di.maxBitStateLen(this.prog))return Di.execute(this,e,t,n,s)}return this.doExecuteNFA(e,t,n,s)}numberOfCapturingGroups(){return this.numSubexp}numberOfInstructions(){return this.prog.numInst()}get(){return this.machinePool.length>0?this.machinePool.pop():null}reset(){this.machinePool.length=0}put(e){this.machinePool.push(e)}toString(){return this.expr}doExecuteNFA(e,t,n,s){let i=this.get();i||(i=ff.fromRE2(this)),i.init(s);let a=i.match(e,t,n)?i.submatches():null;return this.put(i),a}match(e){return this.executeEngine(fe.fromUTF16(e),0,O.UNANCHORED,0)!==null}matchWithGroup(e,t,n,s,i){return e instanceof _n||(K.isByteArray(e)?e=En.utf8(e):e=En.utf16(e)),this.matchMachineInput(e,t,n,s,i)}matchMachineInput(e,t,n,s,i){if(t>n)return[!1,null];let a=e.isUTF16Encoding()?fe.fromUTF16(e.asCharSequence(),0,n):fe.fromUTF8(e.asBytes(),0,n),B=this.executeEngine(a,t,s,2*i);return B===null?[!1,null]:[!0,B]}matchUTF8(e){return this.executeEngine(fe.fromUTF8(e),0,O.UNANCHORED,0)!==null}replaceAll(e,t){return this.replaceAllFunc(e,()=>t,2*e.length+1)}replaceFirst(e,t){return this.replaceAllFunc(e,()=>t,1)}replaceAllFunc(e,t,n){let s=0,i=0,a="",B=fe.fromUTF16(e),u=0;for(;i<=e.length;){let l=this.executeEngine(B,i,O.UNANCHORED,2);if(l===null||l.length===0)break;a+=e.substring(s,l[0]),(l[1]>s||l[0]===0)&&(a+=t(e.substring(l[0],l[1])),u++),s=l[1];let f=B.step(i)&7;if(i+f>l[1]?i+=f:i+1>l[1]?i++:i=l[1],u>=n)break}return a+=e.substring(s),a}pad(e){if(e===null)return null;let t=(1+this.numSubexp)*2;if(e.length<t){let n=new Array(t).fill(-1);for(let s=0;s<e.length;s++)n[s]=e[s];e=n}return e}allMatches(e,t,n=s=>s){let s=[],i=e.endPos();t<0&&(t=i+1);let a=0,B=0,u=-1;for(;B<t&&a<=i;){let l=this.executeEngine(e,a,O.UNANCHORED,this.prog.numCap);if(l===null||l.length===0)break;let f=!0;if(l[1]===a){l[0]===u&&(f=!1);let C=e.step(a);C<0?a=i+1:a+=C&7}else a=l[1];u=l[1],f&&(s.push(n(this.pad(l))),B++)}return s}findUTF8(e){let t=this.executeEngine(fe.fromUTF8(e),0,O.UNANCHORED,2);return t===null?null:e.slice(t[0],t[1])}findUTF8Index(e){let t=this.executeEngine(fe.fromUTF8(e),0,O.UNANCHORED,2);return t===null?null:t.slice(0,2)}find(e){let t=this.executeEngine(fe.fromUTF16(e),0,O.UNANCHORED,2);return t===null?"":e.substring(t[0],t[1])}findIndex(e){return this.executeEngine(fe.fromUTF16(e),0,O.UNANCHORED,2)}findUTF8Submatch(e){let t=this.executeEngine(fe.fromUTF8(e),0,O.UNANCHORED,this.prog.numCap);if(t===null)return null;let n=new Array(1+this.numSubexp).fill(null);for(let s=0;s<n.length;s++)2*s<t.length&&t[2*s]>=0&&(n[s]=e.slice(t[2*s],t[2*s+1]));return n}findUTF8SubmatchIndex(e){return this.pad(this.executeEngine(fe.fromUTF8(e),0,O.UNANCHORED,this.prog.numCap))}findSubmatch(e){let t=this.executeEngine(fe.fromUTF16(e),0,O.UNANCHORED,this.prog.numCap);if(t===null)return null;let n=new Array(1+this.numSubexp).fill(null);for(let s=0;s<n.length;s++)2*s<t.length&&t[2*s]>=0&&(n[s]=e.substring(t[2*s],t[2*s+1]));return n}findSubmatchIndex(e){return this.pad(this.executeEngine(fe.fromUTF16(e),0,O.UNANCHORED,this.prog.numCap))}findAllUTF8(e,t){let n=this.allMatches(fe.fromUTF8(e),t,s=>e.slice(s[0],s[1]));return n.length===0?null:n}findAllUTF8Index(e,t){let n=this.allMatches(fe.fromUTF8(e),t,s=>s.slice(0,2));return n.length===0?null:n}findAll(e,t){let n=this.allMatches(fe.fromUTF16(e),t,s=>e.substring(s[0],s[1]));return n.length===0?null:n}findAllIndex(e,t){let n=this.allMatches(fe.fromUTF16(e),t,s=>s.slice(0,2));return n.length===0?null:n}findAllUTF8Submatch(e,t){let n=this.allMatches(fe.fromUTF8(e),t,s=>{let i=new Array(s.length/2|0).fill(null);for(let a=0;a<i.length;a++)s[2*a]>=0&&(i[a]=e.slice(s[2*a],s[2*a+1]));return i});return n.length===0?null:n}findAllUTF8SubmatchIndex(e,t){let n=this.allMatches(fe.fromUTF8(e),t);return n.length===0?null:n}findAllSubmatch(e,t){let n=this.allMatches(fe.fromUTF16(e),t,s=>{let i=new Array(s.length/2|0).fill(null);for(let a=0;a<i.length;a++)s[2*a]>=0&&(i[a]=e.substring(s[2*a],s[2*a+1]));return i});return n.length===0?null:n}findAllSubmatchIndex(e,t){let n=this.allMatches(fe.fromUTF16(e),t);return n.length===0?null:n}},K_=class wi{static UNANCHORED=O.UNANCHORED;static ANCHOR_START=O.ANCHOR_START;static ANCHOR_BOTH=O.ANCHOR_BOTH;constructor(e=wi.UNANCHORED,t=0,n=8388608){this.anchor=e,this.jsFlags=t,this.maxMem=n;let s=O.PERL;(t&lt.DISABLE_UNICODE_GROUPS)!==0&&(s&=~O.UNICODE_GROUPS),(t&lt.LOOKBEHINDS)!==0&&(s|=O.LOOKBEHIND),this.re2Flags=s,this.regexps=[],this.prog=null,this.dfa=null,this.dummyRe2=null}add(e){if(this.prog)throw new lf("Cannot add patterns after compile");let t=e;(this.jsFlags&lt.CASE_INSENSITIVE)!==0&&(t=`(?i)${t}`),(this.jsFlags&lt.DOTALL)!==0&&(t=`(?s)${t}`),(this.jsFlags&lt.MULTILINE)!==0&&(t=`(?m)${t}`);let n=Ef.parse(t,this.re2Flags);return this.regexps.push(mf.simplify(n)),this.regexps.length-1}compile(){this.prog||(this.prog=gf.compileSet(this.regexps),this.dfa=new df(this.prog,this.maxMem),this.dummyRe2={prog:this.prog,cond:this.prog.startCond(),prefix:"",prefixRune:0,longest:!1})}match(e){this.prog||this.compile();let t=K.isByteArray(e)?fe.fromUTF8(e):fe.fromUTF16(e),n=O.UNANCHORED;this.anchor===wi.ANCHOR_START?n=O.ANCHOR_START:this.anchor===wi.ANCHOR_BOTH&&(n=O.ANCHOR_BOTH);let s=this.dfa.matchSet(t,0,n);if(s!==null)return s;let i=ff.fromRE2(this.dummyRe2);return i.init(0),i.matchSet(t,0,n)}},Wg=class Jn{static isHexadecimal(e){return"0"<=e&&e<="9"||"A"<=e&&e<="F"||"a"<=e&&e<="f"}static translate(e){let t="";if(e instanceof RegExp&&(e.ignoreCase&&(t+="i"),e.multiline&&(t+="m"),e.dotAll&&(t+="s"),e=e.source),typeof e!="string")return e;let n="",s=!1,i=e.length;i===0&&(n="(?:)",s=!0);let a=!1,B=0;for(;B<i;){let l=e[B];if(l==="\\"){if(B+1<i)switch(l=e[B+1],l){case"\\":n+="\\\\",B+=2;continue;case"c":if(B+2<i){let D=e[B+2].charCodeAt(0);if(D>=65&&D<=90||D>=97&&D<=122){let v=D%32;n+="\\x",n+=(v>>4).toString(16).toUpperCase(),n+=(v&15).toString(16).toUpperCase(),B+=3,s=!0;continue}}n+="c",B+=2,s=!0;continue;case"u":if(B+2<i){if(e[B+2]==="{"){let D=B+3,v=!1,R=!1;for(;D<i;){let V=e[D];if(V==="}"){R=!0;break}if(!Jn.isHexadecimal(V))break;v=!0,D++}if(R&&v){n+="\\x",B+=2,s=!0;continue}}else if(B+5<i){let D=!0;for(let v=0;v<4;v++)if(!Jn.isHexadecimal(e[B+2+v])){D=!1;break}if(D){n+="\\x{"+e.substring(B+2,B+6)+"}",B+=6,s=!0;continue}}}n+="u",B+=2,s=!0;continue;case"x":{let D=!1;if(B+2<i&&e[B+2]==="{"){let v=B+3,R=!1,V=!1;for(;v<i;){let H=e[v];if(H==="}"){V=!0;break}if(!Jn.isHexadecimal(H))break;R=!0,v++}V&&R&&(D=!0)}else B+3<i&&Jn.isHexadecimal(e[B+2])&&Jn.isHexadecimal(e[B+3])&&(D=!0);D?(n+="\\x",B+=2):(n+="x",B+=2,s=!0);continue}case"n":case"r":case"t":case"a":case"f":case"v":case"d":case"D":case"s":case"S":case"w":case"W":case"b":case"B":case"p":case"P":case"A":case"z":case"Q":case"E":case"0":case"1":case"2":case"3":case"4":case"5":case"6":case"7":n+="\\"+l,B+=2;continue;default:{let D=e.codePointAt(B+1);if(D>=48&&D<=57||D>=65&&D<=90||D>=97&&D<=122){let v=K.charCount(D);n+=e.substring(B+1,B+1+v),B+=v+1,s=!0}else{n+="\\";let v=K.charCount(D);n+=e.substring(B+1,B+1+v),B+=v+1}continue}}}else if(l==="/"){n+="\\/",B+=1,s=!0;continue}else if(l==="[")a=!0;else if(l==="]")a=!1;else if(!a&&l==="("&&B+2<i&&e[B+1]==="?"&&e[B+2]==="<"&&B+3<i&&!"=!>)".includes(e[B+3])){n+="(?P<",B+=3,s=!0;continue}let f=e.codePointAt(B),C=K.charCount(f);n+=e.substring(B,B+C),B+=C}let u=s?n:e;return t.length>0?`(?${t})${u}`:u}},Ii=class ke{static CASE_INSENSITIVE=lt.CASE_INSENSITIVE;static DOTALL=lt.DOTALL;static MULTILINE=lt.MULTILINE;static DISABLE_UNICODE_GROUPS=lt.DISABLE_UNICODE_GROUPS;static LONGEST_MATCH=lt.LONGEST_MATCH;static LOOKBEHINDS=lt.LOOKBEHINDS;static quote(e){return K.quoteMeta(e)}static quoteReplacement(e,t=!1){return Oh.quoteReplacement(e,t)}static translateRegExp(e){return Wg.translate(e)}static compile(e,t=0){let n=e;if((t&ke.CASE_INSENSITIVE)!==0&&(n=`(?i)${n}`),(t&ke.DOTALL)!==0&&(n=`(?s)${n}`),(t&ke.MULTILINE)!==0&&(n=`(?m)${n}`),(t&~(ke.MULTILINE|ke.DOTALL|ke.CASE_INSENSITIVE|ke.DISABLE_UNICODE_GROUPS|ke.LONGEST_MATCH|ke.LOOKBEHINDS))!==0)throw new Pg("Flags should only be a combination of MULTILINE, DOTALL, CASE_INSENSITIVE, DISABLE_UNICODE_GROUPS, LONGEST_MATCH, LOOKBEHINDS");let s=O.PERL;(t&ke.DISABLE_UNICODE_GROUPS)!==0&&(s&=~O.UNICODE_GROUPS),(t&ke.LOOKBEHINDS)!==0&&(s|=O.LOOKBEHIND);let i=new ke(e,t);return i.re2Input=$g.compileImpl(n,s,(t&ke.LONGEST_MATCH)!==0),i}static matches(e,t){return ke.compile(e).testExact(t)}static initTest(e,t,n){if(e==null)throw new Error("pattern is null");if(n==null)throw new Error("re2 is null");let s=new ke(e,t);return s.re2Input=n,s}constructor(e,t){this.patternInput=e,this.flagsInput=t,this.re2Input=null}reset(){this.re2Input.reset()}flags(){return this.flagsInput}pattern(){return this.patternInput}re2(){return this.re2Input}matches(e){return this.testExact(e)}matcher(e){return K.isByteArray(e)&&(e=En.utf8(e)),new Oh(this,e)}test(e){return K.isByteArray(e)?this.re2Input.matchUTF8(e):this.re2Input.match(e)}testExact(e){let t=K.isByteArray(e)?fe.fromUTF8(e):fe.fromUTF16(e);return this.re2Input.executeEngine(t,0,O.ANCHOR_BOTH,0)!==null}exec(e){let t=this.matcher(e);if(!t.find())return null;let n=[t.group(0)];for(let i=1;i<=t.groupCount();i++){let a=t.group(i);n.push(a===null?void 0:a)}n.index=t.start(0),n.input=e;let s=this.namedGroups();if(Object.keys(s).length>0){let i=t.getNamedGroups();for(let a in i)i[a]===null&&(i[a]=void 0);n.groups=i}else n.groups=void 0;return n}split(e,t=0){let n=this.matcher(e),s=[],i=0,a=0;for(;n.find();){if(a===0&&n.end()===0){a=n.end();continue}if(t>0&&s.length===t-1)break;if(a===n.start()){if(t===0){i+=1,a=n.end();continue}}else for(;i>0;)s.push(""),i-=1;s.push(n.substring(a,n.start())),a=n.end()}if(t===0&&a!==n.inputLength()){for(;i>0;)s.push(""),i-=1;s.push(n.substring(a,n.inputLength()))}return(t!==0||s.length===0&&!(a===n.inputLength()&&a>0))&&s.push(n.substring(a,n.inputLength())),s}*matchAll(e){let t=this.matcher(e);for(;t.find();){let n=[t.group(0)];for(let i=1;i<=t.groupCount();i++){let a=t.group(i);n.push(a===null?void 0:a)}n.index=t.start(0),n.input=e;let s=this.namedGroups();if(Object.keys(s).length>0){let i=t.getNamedGroups();for(let a in i)i[a]===null&&(i[a]=void 0);n.groups=i}else n.groups=void 0;yield n}}toString(){return this.patternInput}programSize(){return this.re2Input.numberOfInstructions()}groupCount(){return this.re2Input.numberOfCapturingGroups()}namedGroups(){return this.re2Input.namedGroups}equals(e){return this===e?!0:e===null||this.constructor!==e.constructor?!1:this.flagsInput===e.flagsInput&&this.patternInput===e.patternInput}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var br="12.18.0";function rd(r){br=r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var vn=new Hn("@firebase/firestore");function Kn(){return vn.logLevel}function U(r,...e){if(vn.logLevel<=se.DEBUG){let t=e.map(Sc);vn.debug(`Firestore (${br}): ${r}`,...t)}}function xt(r,...e){if(vn.logLevel<=se.ERROR){let t=e.map(Sc);vn.error(`Firestore (${br}): ${r}`,...t)}}function ut(r,...e){if(vn.logLevel<=se.WARN){let t=e.map(Sc);vn.warn(`Firestore (${br}): ${r}`,...t)}}function Sc(r){if(typeof r=="string")return r;try{return(function(t){return JSON.stringify(t)})(r)}catch{return r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Y(r,e,t){let n="Unexpected state";typeof e=="string"?n=e:t=e,sd(r,n,t)}function sd(r,e,t){let n=`FIRESTORE (${br}) INTERNAL ASSERTION FAILED: ${e} (ID: ${r.toString(16)})`;if(t!==void 0)try{n+=" CONTEXT: "+JSON.stringify(t)}catch{n+=" CONTEXT: "+t}throw xt(n),new Error(n)}function $(r,e,t,n){let s="Unexpected state";typeof t=="string"?s=t:n=t,r||sd(e,s,n)}function Be(r,e){return r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yg(r){let e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(r);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let n=0;n<r;n++)t[n]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var rr=class{static newId(){let e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516),n="";for(;n.length<20;){let s=Yg(40);for(let i=0;i<s.length;++i)n.length<20&&s[i]<t&&(n+=e.charAt(s[i]%62))}return n}};function ne(r,e){return r<e?-1:r>e?1:0}function $a(r,e){let t=Math.min(r.length,e.length);for(let n=0;n<t;n++){let s=r.charAt(n),i=e.charAt(n);if(s!==i)return Ha(s)===Ha(i)?ne(s,i):Ha(s)?1:-1}return ne(r.length,e.length)}var Xg=55296,Zg=57343;function Ha(r){let e=r.charCodeAt(0);return e>=Xg&&e<=Zg}function sr(r,e,t){return r.length===e.length&&r.every(((n,s)=>t(n,e[s])))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var _e=class r{constructor(e,t){this.comparator=e,this.root=t||Et.EMPTY}insert(e,t){return new r(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,Et.BLACK,null,null))}remove(e){return new r(this.comparator,this.root.remove(e,this.comparator).copy(null,null,Et.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){let n=this.comparator(e,t.key);if(n===0)return t.value;n<0?t=t.left:n>0&&(t=t.right)}return null}indexOf(e){let t=0,n=this.root;for(;!n.isEmpty();){let s=this.comparator(e,n.key);if(s===0)return t+n.left.size;s<0?n=n.left:(t+=n.left.size+1,n=n.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,n)=>(e(t,n),!1)))}toString(){let e=[];return this.inorderTraversal(((t,n)=>(e.push(`${t}:${n}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Yn(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Yn(this.root,e,this.comparator,!1)}getReverseIterator(){return new Yn(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Yn(this.root,e,this.comparator,!0)}},Yn=class{constructor(e,t,n,s){this.isReverse=s,this.nodeStack=[];let i=1;for(;!e.isEmpty();)if(i=t?n(e.key,t):1,t&&s&&(i*=-1),i<0)e=this.isReverse?e.left:e.right;else{if(i===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop(),t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;let e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}},Et=class r{constructor(e,t,n,s,i){this.key=e,this.value=t,this.color=n??r.RED,this.left=s??r.EMPTY,this.right=i??r.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,n,s,i){return new r(e??this.key,t??this.value,n??this.color,s??this.left,i??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,n){let s=this,i=n(e,s.key);return s=i<0?s.copy(null,null,null,s.left.insert(e,t,n),null):i===0?s.copy(null,t,null,null,null):s.copy(null,null,null,null,s.right.insert(e,t,n)),s.fixUp()}removeMin(){if(this.left.isEmpty())return r.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let n,s=this;if(t(e,s.key)<0)s.left.isEmpty()||s.left.isRed()||s.left.left.isRed()||(s=s.moveRedLeft()),s=s.copy(null,null,null,s.left.remove(e,t),null);else{if(s.left.isRed()&&(s=s.rotateRight()),s.right.isEmpty()||s.right.isRed()||s.right.left.isRed()||(s=s.moveRedRight()),t(e,s.key)===0){if(s.right.isEmpty())return r.EMPTY;n=s.right.min(),s=s.copy(n.key,n.value,null,null,s.right.removeMin())}s=s.copy(null,null,null,null,s.right.remove(e,t))}return s.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){let e=this.copy(null,null,r.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){let e=this.copy(null,null,r.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){let e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){let e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw Y(43730,{key:this.key,value:this.value});if(this.right.isRed())throw Y(14113,{key:this.key,value:this.value});let e=this.left.check();if(e!==this.right.check())throw Y(27949);return e+(this.isRed()?0:1)}};Et.EMPTY=null,Et.RED=!0,Et.BLACK=!1;Et.EMPTY=new class{constructor(){this.size=0}get key(){throw Y(57766)}get value(){throw Y(16141)}get color(){throw Y(16727)}get left(){throw Y(29726)}get right(){throw Y(36894)}copy(e,t,n,s,i){return this}insert(e,t,n){return new Et(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Re=class r{constructor(e){this.comparator=e,this.data=new _e(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,n)=>(e(t),!1)))}forEachInRange(e,t){let n=this.data.getIteratorFrom(e[0]);for(;n.hasNext();){let s=n.getNext();if(this.comparator(s.key,e[1])>=0)return;t(s.key)}}forEachWhile(e,t){let n;for(n=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();n.hasNext();)if(!e(n.getNext().key))return}firstAfterOrEqual(e){let t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new Ni(this.data.getIterator())}getIteratorFrom(e){return new Ni(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((n=>{t=t.add(n)})),t}isEqual(e){if(!(e instanceof r)||this.size!==e.size)return!1;let t=this.data.getIterator(),n=e.data.getIterator();for(;t.hasNext();){let s=t.getNext().key,i=n.getNext().key;if(this.comparator(s,i)!==0)return!1}return!0}toArray(){let e=[];return this.forEach((t=>{e.push(t)})),e}toString(){let e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){let t=new r(this.comparator);return t.data=e,t}},Ni=class{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var M={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"},j=class extends yt{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ir="__name__",Fi=class r{constructor(e,t,n){t===void 0?t=0:t>e.length&&Y(637,{offset:t,range:e.length}),n===void 0?n=e.length-t:n>e.length-t&&Y(1746,{length:n,range:e.length-t}),this.segments=e,this.offset=t,this.len=n}get length(){return this.len}isEqual(e){return r.comparator(this,e)===0}child(e){let t=this.segments.slice(this.offset,this.limit());return e instanceof r?e.forEach((n=>{t.push(n)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,n=this.limit();t<n;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){let n=Math.min(e.length,t.length);for(let s=0;s<n;s++){let i=r.compareSegments(e.get(s),t.get(s));if(i!==0)return i}return ne(e.length,t.length)}static compareSegments(e,t){let n=r.isNumericId(e),s=r.isNumericId(t);return n&&!s?-1:!n&&s?1:n&&s?r.extractNumericId(e).compare(r.extractNumericId(t)):$a(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return At.fromString(e.substring(4,e.length-2))}},le=class r extends Fi{construct(e,t,n){return new r(e,t,n)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toStringWithLeadingSlash(){return`/${this.canonicalString()}`}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){let t=[];for(let n of e){if(n.indexOf("//")>=0)throw new j(M.INVALID_ARGUMENT,`Invalid segment (${n}). Paths must not contain // in them.`);t.push(...n.split("/").filter((s=>s.length>0)))}return new r(t)}static emptyPath(){return new r([])}},em=/^[_a-zA-Z][_a-zA-Z0-9]*$/,Bt=class zn extends Fi{construct(e,t,n){return new zn(e,t,n)}static isValidIdentifier(e){return em.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),zn.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===ir}static keyField(){return new zn([ir])}static fromServerFormat(e){let t=[],n="",s=0,i=()=>{if(n.length===0)throw new j(M.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(n),n=""},a=!1;for(;s<e.length;){let B=e[s];if(B==="\\"){if(s+1===e.length)throw new j(M.INVALID_ARGUMENT,"Path has trailing escape character: "+e);let u=e[s+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new j(M.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);n+=u,s+=2}else B==="`"?(a=!a,s++):B!=="."||a?(n+=B,s++):(i(),s++)}if(i(),a)throw new j(M.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new zn(t)}static emptyPath(){return new zn([])}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var yn=class r{constructor(e){this.fields=e,e.sort(Bt.comparator)}static empty(){return new r([])}unionWith(e){let t=new Re(Bt.comparator);for(let n of this.fields)t=t.add(n);for(let n of e)t=t.add(n);return new r(t.toArray())}covers(e){for(let t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return sr(this.fields,e.fields,((t,n)=>t.isEqual(n)))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xi(r){let e=0;for(let t in r)Object.prototype.hasOwnProperty.call(r,t)&&e++;return e}function vr(r,e){for(let t in r)Object.prototype.hasOwnProperty.call(r,t)&&e(t,r[t])}function id(r,e){let t=[];for(let n in r)Object.prototype.hasOwnProperty.call(r,n)&&t.push(e(r[n],n,r));return t}function od(r){for(let e in r)if(Object.prototype.hasOwnProperty.call(r,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Q=class r{constructor(e){this.path=e}static fromPath(e){return new r(le.fromString(e))}static fromName(e){return new r(le.fromString(e).popFirst(5))}static empty(){return new r(le.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&le.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return le.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new r(new le(e.slice()))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ad(r,e,t){if(!t)throw new j(M.INVALID_ARGUMENT,`Function ${r}() cannot be called with an empty ${e}.`)}function Bd(r,e,t,n){if(e===!0&&n===!0)throw new j(M.INVALID_ARGUMENT,`${r} and ${t} cannot be used together.`)}function _f(r){if(!Q.isDocumentKey(r))throw new j(M.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${r} has ${r.length}.`)}function Df(r){if(Q.isDocumentKey(r))throw new j(M.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${r} has ${r.length}.`)}function Gs(r){return typeof r=="object"&&r!==null&&(Object.getPrototypeOf(r)===Object.prototype||Object.getPrototypeOf(r)===null)}function Do(r){if(r===void 0)return"undefined";if(r===null)return"null";if(typeof r=="string")return r.length>20&&(r=`${r.substring(0,20)}...`),JSON.stringify(r);if(typeof r=="number"||typeof r=="boolean")return""+r;if(typeof r=="object"){if(r instanceof Array)return"an array";{let e=(function(n){return n.constructor?n.constructor.name:null})(r);return e?`a custom ${e} object`:"an object"}}return typeof r=="function"?"a function":Y(12329,{type:typeof r})}function Hs(r,e){if("_delegate"in r&&(r=r._delegate),!(r instanceof e)){if(e.name===r.constructor.name)throw new j(M.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{let t=Do(r);throw new j(M.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return r}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ie(r,e){let t={typeString:r};return e&&(t.value=e),t}function Us(r,e){if(!Gs(r))throw new j(M.INVALID_ARGUMENT,"JSON must be an object");let t;for(let n in e)if(e[n]){let s=e[n].typeString,i="value"in e[n]?{value:e[n].value}:void 0;if(!(n in r)){t=`JSON missing required field: '${n}'`;break}let a=r[n];if(s&&typeof a!==s){t=`JSON field '${n}' must be a ${s}.`;break}if(i!==void 0&&a!==i.value){t=`Expected '${n}' field to equal '${i.value}'`;break}}if(t)throw new j(M.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var yf=-62135596800,wf=1e6,Te=class r{static now(){return r.fromMillis(Date.now())}static fromDate(e){return r.fromMillis(e.getTime())}static fromMillis(e){let t=Math.floor(e/1e3),n=Math.floor((e-1e3*t)*wf);return new r(t,n)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new j(M.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new j(M.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<yf)throw new j(M.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new j(M.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/wf}_compareTo(e){return this.seconds===e.seconds?ne(this.nanoseconds,e.nanoseconds):ne(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:r._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(Us(e,r._jsonSchema))return new r(e.seconds,e.nanoseconds)}valueOf(){let e=this.seconds-yf;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}};Te._jsonSchemaVersion="firestore/timestamp/1.0",Te._jsonSchema={type:Ie("string",Te._jsonSchemaVersion),seconds:Ie("number"),nanoseconds:Ie("number")};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Pi=class extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ae=class r{constructor(e){this.binaryString=e}static fromBase64String(e){let t=(function(s){try{return atob(s)}catch(i){throw typeof DOMException<"u"&&i instanceof DOMException?new Pi("Invalid base64 string: "+i):i}})(e);return new r(t)}static fromUint8Array(e){let t=(function(s){let i="";for(let a=0;a<s.length;++a)i+=String.fromCharCode(s[a]);return i})(e);return new r(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){let n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t.charCodeAt(s);return n})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return ne(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}};Ae.EMPTY_BYTE_STRING=new Ae("");var tm=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Pt(r){if($(!!r,39018),typeof r=="string"){let e=0,t=tm.exec(r);if($(!!t,46558,{timestamp:r}),t[1]){let s=t[1];s=(s+"000000000").substr(0,9),e=Number(s)}let n=new Date(r);return{seconds:Math.floor(n.getTime()/1e3),nanos:e}}return{seconds:Ce(r.seconds),nanos:Ce(r.nanos)}}function Ce(r){return typeof r=="number"?r:typeof r=="string"?Number(r):0}function Ot(r){return typeof r=="string"?Ae.fromBase64String(r):Ae.fromUint8Array(r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ud="server_timestamp",cd="__type__",ld="__previous_value__",hd="__local_write_time__";function qs(r){return(r?.mapValue?.fields||{})[cd]?.stringValue===ud}function js(r){let e=r.mapValue.fields[ld];return qs(e)?js(e):e}function or(r){let e=Pt(r.mapValue.fields[hd].timestampValue);return new Te(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Wa=class{constructor(e,t,n,s,i,a,B,u,l,f,C,D,v){this.databaseId=e,this.appId=t,this.persistenceKey=n,this.host=s,this.ssl=i,this.forceLongPolling=a,this.autoDetectLongPolling=B,this.longPollingOptions=u,this.useFetchStreams=l,this.isUsingEmulator=f,this.apiKey=C,this._customHeaders=D,this.grpcFlowControlWindow=v}},Oi="(default)",us=class r{constructor(e,t){this.projectId=e,this.database=t||Oi}static empty(){return new r("","")}get isDefaultDatabase(){return this.database===Oi}isEqual(e){return e instanceof r&&e.projectId===this.projectId&&e.database===this.database}};function fd(r,e){if(!Object.prototype.hasOwnProperty.apply(r.options,["projectId"]))throw new j(M.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new us(r.options.projectId,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var nm=-1;function yo(r){return r==null}function ar(r){return r===0&&1/r==-1/0}function rm(r){return typeof r=="number"&&Number.isInteger(r)&&!ar(r)&&r<=Number.MAX_SAFE_INTEGER&&r>=Number.MIN_SAFE_INTEGER}function sm(r){return typeof r=="string"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Rc="__type__",dd="__max__",Ti={mapValue:{fields:{__type__:{stringValue:dd}}}},Nc="__vector__",Sn="value",Br={nullValue:"NULL_VALUE"},$e={booleanValue:!0},Pe={booleanValue:!1};function be(r){return"nullValue"in r?0:"booleanValue"in r?1:"integerValue"in r||"doubleValue"in r?2:"timestampValue"in r?3:"stringValue"in r?5:"bytesValue"in r?6:"referenceValue"in r?7:"geoPointValue"in r?8:"arrayValue"in r?9:"mapValue"in r?qs(r)?4:Cd(r)?9007199254740991:ls(r)?10:11:Y(28295,{value:r})}function ct(r,e,t){if(r===e)return!0;let n=be(r);if(n!==be(e))return!1;switch(n){case 0:case 9007199254740991:return!0;case 1:return r.booleanValue===e.booleanValue;case 4:return or(r).isEqual(or(e));case 3:return(function(i,a){if(typeof i.timestampValue=="string"&&typeof a.timestampValue=="string"&&i.timestampValue.length===a.timestampValue.length)return i.timestampValue===a.timestampValue;let B=Pt(i.timestampValue),u=Pt(a.timestampValue);return B.seconds===u.seconds&&B.nanos===u.nanos})(r,e);case 5:return r.stringValue===e.stringValue;case 6:return(function(i,a){return Ot(i.bytesValue).isEqual(Ot(a.bytesValue))})(r,e);case 7:return r.referenceValue===e.referenceValue;case 8:return(function(i,a){return Ce(i.geoPointValue.latitude)===Ce(a.geoPointValue.latitude)&&Ce(i.geoPointValue.longitude)===Ce(a.geoPointValue.longitude)})(r,e);case 2:return(function(i,a,B){if("integerValue"in i&&"integerValue"in a)return Ce(i.integerValue)===Ce(a.integerValue);let u,l;if("doubleValue"in i&&"doubleValue"in a)u=Ce(i.doubleValue),l=Ce(a.doubleValue);else{if(!B?.t)return!1;u=Ce(i.integerValue??i.doubleValue),l=Ce(a.integerValue??a.doubleValue)}return u===l?!!B?.i||ar(u)===ar(l):!!(B===void 0||B.o)&&isNaN(u)&&isNaN(l)})(r,e,t);case 9:return sr(r.arrayValue.values||[],e.arrayValue.values||[],((s,i)=>ct(s,i,t)));case 10:case 11:return(function(i,a,B){let u=i.mapValue.fields||{},l=a.mapValue.fields||{};if(xi(u)!==xi(l))return!1;for(let f in u)if(u.hasOwnProperty(f)&&(l[f]===void 0||!ct(u[f],l[f],B)))return!1;return!0})(r,e,t);default:return Y(52216,{left:r})}}function cs(r,e){return(r.values||[]).find((t=>ct(t,e)))!==void 0}function We(r,e){if(r===e)return 0;let t=be(r),n=be(e);if(t!==n)return ne(t,n);switch(t){case 0:case 9007199254740991:return 0;case 1:return ne(r.booleanValue,e.booleanValue);case 2:return(function(i,a){let B=Ce(i.integerValue||i.doubleValue),u=Ce(a.integerValue||a.doubleValue);return B<u?-1:B>u?1:B===u?0:isNaN(B)?isNaN(u)?0:-1:1})(r,e);case 3:return If(r.timestampValue,e.timestampValue);case 4:return If(or(r),or(e));case 5:return $a(r.stringValue,e.stringValue);case 6:return(function(i,a){let B=Ot(i),u=Ot(a);return B.compareTo(u)})(r.bytesValue,e.bytesValue);case 7:return(function(i,a){let B=i.split("/"),u=a.split("/");for(let l=0;l<B.length&&l<u.length;l++){let f=ne(B[l],u[l]);if(f!==0)return f}return ne(B.length,u.length)})(r.referenceValue,e.referenceValue);case 8:return(function(i,a){let B=ne(Ce(i.latitude),Ce(a.latitude));return B!==0?B:ne(Ce(i.longitude),Ce(a.longitude))})(r.geoPointValue,e.geoPointValue);case 9:return Tf(r.arrayValue,e.arrayValue);case 10:return(function(i,a){let B=i.fields||{},u=a.fields||{},l=B[Sn]?.arrayValue,f=u[Sn]?.arrayValue,C=ne(l?.values?.length||0,f?.values?.length||0);return C!==0?C:Tf(l,f)})(r.mapValue,e.mapValue);case 11:return(function(i,a){if(i===Ti.mapValue&&a===Ti.mapValue)return 0;if(i===Ti.mapValue)return 1;if(a===Ti.mapValue)return-1;let B=i.fields||{},u=Object.keys(B),l=a.fields||{},f=Object.keys(l);u.sort(),f.sort();for(let C=0;C<u.length&&C<f.length;++C){let D=$a(u[C],f[C]);if(D!==0)return D;let v=We(B[u[C]],l[f[C]]);if(v!==0)return v}return ne(u.length,f.length)})(r.mapValue,e.mapValue);default:throw Y(23264,{u:t})}}function If(r,e){if(typeof r=="string"&&typeof e=="string"&&r.length===e.length)return ne(r,e);let t=Pt(r),n=Pt(e),s=ne(t.seconds,n.seconds);return s!==0?s:ne(t.nanos,n.nanos)}function Tf(r,e){let t=r.values||[],n=e.values||[];for(let s=0;s<t.length&&s<n.length;++s){let i=We(t[s],n[s]);if(i!==void 0&&i!==0)return i}return ne(t.length,n.length)}function ur(r){return Ya(r)}function Ya(r){return"nullValue"in r?"null":"booleanValue"in r?""+r.booleanValue:"integerValue"in r?""+r.integerValue:"doubleValue"in r?""+r.doubleValue:"timestampValue"in r?(function(t){let n=Pt(t);return`time(${n.seconds},${n.nanos})`})(r.timestampValue):"stringValue"in r?r.stringValue:"bytesValue"in r?(function(t){return Ot(t).toBase64()})(r.bytesValue):"referenceValue"in r?(function(t){return Q.fromName(t).toString()})(r.referenceValue):"geoPointValue"in r?(function(t){return`geo(${t.latitude},${t.longitude})`})(r.geoPointValue):"arrayValue"in r?(function(t){let n="[",s=!0;for(let i of t.values||[])s?s=!1:n+=",",n+=Ya(i);return n+"]"})(r.arrayValue):"mapValue"in r?(function(t){let n=Object.keys(t.fields||{}).sort(),s="{",i=!0;for(let a of n)i?i=!1:s+=",",s+=`${a}:${Ya(t.fields[a])}`;return s+"}"})(r.mapValue):Y(61005,{value:r})}function Si(r){switch(be(r)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:let e=js(r);return e?16+Si(e):16;case 5:return 2*r.stringValue.length;case 6:return Ot(r.bytesValue).approximateByteSize();case 7:return r.referenceValue.length;case 9:return(function(n){return(n.values||[]).reduce(((s,i)=>s+Si(i)),0)})(r.arrayValue);case 10:case 11:return(function(n){let s=0;return vr(n.fields,((i,a)=>{s+=i.length+Si(a)})),s})(r.mapValue);default:throw Y(13486,{value:r})}}function mt(r){return!!r&&"integerValue"in r}function wn(r){return!!r&&"doubleValue"in r}function nn(r){return mt(r)||wn(r)}function cr(r){return!!r&&"arrayValue"in r}function nt(r){return!!r&&"nullValue"in r}function Ye(r){return!!r&&"doubleValue"in r&&isNaN(Number(r.doubleValue))}function Xn(r){return!!r&&"mapValue"in r}function ls(r){return(r?.mapValue?.fields||{})[Rc]?.stringValue===Nc}function Xa(r){return(r?.mapValue?.fields||{})[Sn]?.arrayValue}function ss(r){if(r.geoPointValue)return{geoPointValue:{...r.geoPointValue}};if(r.timestampValue&&typeof r.timestampValue=="object")return{timestampValue:{...r.timestampValue}};if(r.mapValue){let e={mapValue:{fields:{}}};return vr(r.mapValue.fields,((t,n)=>e.mapValue.fields[t]=ss(n))),e}if(r.arrayValue){let e={arrayValue:{values:[]}};for(let t=0;t<(r.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=ss(r.arrayValue.values[t]);return e}return{...r}}function Cd(r){return(((r.mapValue||{}).fields||{}).__type__||{}).stringValue===dd}var RD={mapValue:{fields:{[Rc]:{stringValue:Nc},[Sn]:{arrayValue:{}}}}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ht=class r{constructor(e){this.value=e}static empty(){return new r({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let n=0;n<e.length-1;++n)if(t=(t.mapValue.fields||{})[e.get(n)],!Xn(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=ss(t)}setAll(e){let t=Bt.emptyPath(),n={},s=[];e.forEach(((a,B)=>{if(!t.isImmediateParentOf(B)){let u=this.getFieldsMap(t);this.applyChanges(u,n,s),n={},s=[],t=B.popLast()}a?n[B.lastSegment()]=ss(a):s.push(B.lastSegment())}));let i=this.getFieldsMap(t);this.applyChanges(i,n,s)}delete(e){let t=this.field(e.popLast());Xn(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return ct(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let n=0;n<e.length;++n){let s=t.mapValue.fields[e.get(n)];Xn(s)&&s.mapValue.fields||(s={mapValue:{fields:{}}},t.mapValue.fields[e.get(n)]=s),t=s}return t.mapValue.fields}applyChanges(e,t,n){vr(t,((s,i)=>e[s]=i));for(let s of n)delete e[s]}clone(){return new r(ss(this.value))}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wo(r,e){if(r.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:ar(e)?"-0":e}}function Fc(r){return{integerValue:""+r}}function xc(r,e,t){return rm(e)?Fc(e):wo(r,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var lr=class{constructor(){this._=void 0}};function im(r,e,t){return r instanceof hs?(function(s,i){let a={fields:{[cd]:{stringValue:ud},[hd]:{timestampValue:{seconds:s.seconds,nanos:s.nanoseconds}}}};return i&&qs(i)&&(i=js(i)),i&&(a.fields[ld]=i),{mapValue:a}})(t,e):r instanceof hr?pd(r,e):r instanceof fr?gd(r,e):r instanceof dr?(function(s,i){let a=am(s,i),B=Li(a)+Li(s.l);return mt(a)&&mt(s.l)?Fc(B):wo(s.serializer,B)})(r,e):r instanceof ds?(function(s,i){return Af(s,i,Math.min)})(r,e):r instanceof Cs?(function(s,i){return Af(s,i,Math.max)})(r,e):void 0}function om(r,e,t){return r instanceof hr?pd(r,e):r instanceof fr?gd(r,e):t}function am(r,e){return r instanceof dr?nn(e)?e:{integerValue:0}:null}var hs=class extends lr{},hr=class extends lr{constructor(e){super(),this.elements=e}};function pd(r,e){let t=md(e);for(let n of r.elements)t.some((s=>ct(s,n)))||t.push(n);return{arrayValue:{values:t}}}var fr=class extends lr{constructor(e){super(),this.elements=e}};function gd(r,e){let t=md(e);for(let n of r.elements)t=t.filter((s=>!ct(s,n)));return{arrayValue:{values:t}}}var fs=class extends lr{constructor(e,t){super(),this.serializer=e,this.l=t}},dr=class extends fs{},ds=class extends fs{},Cs=class extends fs{};function Af(r,e,t){if(!nn(e))return r.l;let n=t(Li(e),Li(r.l));return mt(e)&&mt(r.l)?Fc(n):wo(r.serializer,n)}function Li(r){return Ce(r.integerValue||r.doubleValue)}function md(r){return cr(r)&&r.arrayValue.values?r.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bm(r,e){return r.field.isEqual(e.field)&&(function(n,s){return n instanceof hr&&s instanceof hr||n instanceof fr&&s instanceof fr?sr(n.elements,s.elements,ct):n instanceof dr&&s instanceof dr||n instanceof ds&&s instanceof ds||n instanceof Cs&&s instanceof Cs?ct(n.l,s.l):n instanceof hs&&s instanceof hs})(r.transform,e.transform)}var Zn=class r{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new r}static exists(e){return new r(void 0,e)}static updateTime(e){return new r(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}};function Ri(r,e){return r.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(r.updateTime):r.exists===void 0||r.exists===e.isFoundDocument()}var ps=class{};function Ed(r,e){if(!r.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return r.isNoDocument()?new Vi(r.key,Zn.none()):new gs(r.key,r.data,Zn.none());{let t=r.data,n=ht.empty(),s=new Re(Bt.comparator);for(let i of e.fields)if(!s.has(i)){let a=t.field(i);a===null&&i.length>1&&(i=i.popLast(),a=t.field(i)),a===null?n.delete(i):n.set(i,a),s=s.add(i)}return new Cr(r.key,n,new yn(s.toArray()),Zn.none())}}function um(r,e,t){r instanceof gs?(function(s,i,a){let B=s.value.clone(),u=vf(s.fieldTransforms,i,a.transformResults);B.setAll(u),i.convertToFoundDocument(a.version,B).setHasCommittedMutations()})(r,e,t):r instanceof Cr?(function(s,i,a){if(!Ri(s.precondition,i))return void i.convertToUnknownDocument(a.version);let B=vf(s.fieldTransforms,i,a.transformResults),u=i.data;u.setAll(_d(s)),u.setAll(B),i.convertToFoundDocument(a.version,u).setHasCommittedMutations()})(r,e,t):(function(s,i,a){i.convertToNoDocument(a.version).setHasCommittedMutations()})(0,e,t)}function is(r,e,t,n){return r instanceof gs?(function(i,a,B,u){if(!Ri(i.precondition,a))return B;let l=i.value.clone(),f=Sf(i.fieldTransforms,u,a);return l.setAll(f),a.convertToFoundDocument(a.version,l).setHasLocalMutations(),null})(r,e,t,n):r instanceof Cr?(function(i,a,B,u){if(!Ri(i.precondition,a))return B;let l=Sf(i.fieldTransforms,u,a),f=a.data;return f.setAll(_d(i)),f.setAll(l),a.convertToFoundDocument(a.version,f).setHasLocalMutations(),B===null?null:B.unionWith(i.fieldMask.fields).unionWith(i.fieldTransforms.map((C=>C.field)))})(r,e,t,n):(function(i,a,B){return Ri(i.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):B})(r,e,t)}function bf(r,e){return r.type===e.type&&!!r.key.isEqual(e.key)&&!!r.precondition.isEqual(e.precondition)&&!!(function(n,s){return n===void 0&&s===void 0||!(!n||!s)&&sr(n,s,((i,a)=>Bm(i,a)))})(r.fieldTransforms,e.fieldTransforms)&&(r.type===0?r.value.isEqual(e.value):r.type!==1||r.data.isEqual(e.data)&&r.fieldMask.isEqual(e.fieldMask))}var gs=class extends ps{constructor(e,t,n,s=[]){super(),this.key=e,this.value=t,this.precondition=n,this.fieldTransforms=s,this.type=0}getFieldMask(){return null}},Cr=class extends ps{constructor(e,t,n,s,i=[]){super(),this.key=e,this.data=t,this.fieldMask=n,this.precondition=s,this.fieldTransforms=i,this.type=1}getFieldMask(){return this.fieldMask}};function _d(r){let e=new Map;return r.fieldMask.fields.forEach((t=>{if(!t.isEmpty()){let n=r.data.field(t);e.set(t,n)}})),e}function vf(r,e,t){let n=new Map;$(r.length===t.length,32656,{h:t.length,T:r.length});for(let s=0;s<t.length;s++){let i=r[s],a=i.transform,B=e.data.field(i.field);n.set(i.field,om(a,B,t[s]))}return n}function Sf(r,e,t){let n=new Map;for(let s of r){let i=s.transform,a=t.data.field(s.field);n.set(s.field,im(i,a,e))}return n}var Vi=class extends ps{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Rn=class{constructor(e,t){this.position=e,this.inclusive=t}};function Rf(r,e,t){let n=0;for(let s=0;s<r.position.length;s++){let i=e[s],a=r.position[s];if(i.field.isKeyField()?n=Q.comparator(Q.fromName(a.referenceValue),t.key):n=We(a,t.data.field(i.field)),i.dir==="desc"&&(n*=-1),n!==0)break}return n}function Nf(r,e){if(r===null)return e===null;if(e===null||r.inclusive!==e.inclusive||r.position.length!==e.position.length)return!1;for(let t=0;t<r.position.length;t++)if(!ct(r.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ki=class{},we=class r extends ki{constructor(e,t,n){super(),this.field=e,this.op=t,this.value=n}static create(e,t,n){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,n):new eB(e,t,n):t==="array-contains"?new rB(e,n):t==="in"?new sB(e,n):t==="not-in"?new iB(e,n):t==="array-contains-any"?new oB(e,n):new r(e,t,n)}static createKeyFieldInFilter(e,t,n){return t==="in"?new tB(e,n):new nB(e,n)}matches(e){let t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(We(t,this.value)):t!==null&&be(this.value)===be(t)&&this.matchesComparison(We(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return Y(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}},ft=class r extends ki{constructor(e,t){super(),this.filters=e,this.op=t,this.P=null}static create(e,t){return new r(e,t)}matches(e){return Dd(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.P!==null||(this.P=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.P}getFilters(){return Object.assign([],this.filters)}};function Dd(r){return r.op==="and"}function yd(r){return cm(r)&&Dd(r)}function cm(r){for(let e of r.filters)if(e instanceof ft)return!1;return!0}function Za(r){if(r instanceof we)return r.field.canonicalString()+r.op.toString()+ur(r.value);if(yd(r))return r.filters.map((e=>Za(e))).join(",");{let e=r.filters.map((t=>Za(t))).join(",");return`${r.op}(${e})`}}function wd(r,e){return r instanceof we?(function(n,s){return s instanceof we&&n.op===s.op&&n.field.isEqual(s.field)&&ct(n.value,s.value)})(r,e):r instanceof ft?(function(n,s){return s instanceof ft&&n.op===s.op&&n.filters.length===s.filters.length?n.filters.reduce(((i,a,B)=>i&&wd(a,s.filters[B])),!0):!1})(r,e):void Y(19439)}function Id(r){return r instanceof we?(function(t){return`${t.field.canonicalString()} ${t.op} ${ur(t.value)}`})(r):r instanceof ft?(function(t){return t.op.toString()+" {"+t.getFilters().map(Id).join(" ,")+"}"})(r):"Filter"}var eB=class extends we{constructor(e,t,n){super(e,t,n),this.key=Q.fromName(n.referenceValue)}matches(e){let t=Q.comparator(e.key,this.key);return this.matchesComparison(t)}},tB=class extends we{constructor(e,t){super(e,"in",t),this.keys=Td("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}},nB=class extends we{constructor(e,t){super(e,"not-in",t),this.keys=Td("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}};function Td(r,e){return(e.arrayValue?.values||[]).map((t=>Q.fromName(t.referenceValue)))}var rB=class extends we{constructor(e,t){super(e,"array-contains",t)}matches(e){let t=e.data.field(this.field);return cr(t)&&cs(t.arrayValue,this.value)}},sB=class extends we{constructor(e,t){super(e,"in",t)}matches(e){let t=e.data.field(this.field);return t!==null&&cs(this.value.arrayValue,t)}},iB=class extends we{constructor(e,t){super(e,"not-in",t)}matches(e){if(cs(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;let t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!cs(this.value.arrayValue,t)}},oB=class extends we{constructor(e,t){super(e,"array-contains-any",t)}matches(e){let t=e.data.field(this.field);return!(!cr(t)||!t.arrayValue.values)&&t.arrayValue.values.some((n=>cs(this.value.arrayValue,n)))}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Nn=class{constructor(e,t="asc"){this.field=e,this.dir=t}};function lm(r,e){return r.dir===e.dir&&r.field.isEqual(e.field)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Z=class r{static fromTimestamp(e){return new r(e)}static min(){return new r(new Te(0,0))}static max(){return new r(new Te(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var dt=class r{constructor(e,t,n,s,i,a,B){this.key=e,this.documentType=t,this.version=n,this.readTime=s,this.createTime=i,this.data=a,this.documentState=B}static newInvalidDocument(e){return new r(e,0,Z.min(),Z.min(),Z.min(),ht.empty(),0)}static newFoundDocument(e,t,n,s){return new r(e,1,t,Z.min(),n,s,0)}static newNoDocument(e,t){return new r(e,2,t,Z.min(),Z.min(),ht.empty(),0)}static newUnknownDocument(e,t){return new r(e,3,t,Z.min(),Z.min(),ht.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(Z.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=ht.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=ht.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=Z.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof r&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new r(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ms=-1,Mi=class{constructor(e,t,n,s){this.indexId=e,this.collectionGroup=t,this.fields=n,this.indexState=s}};Mi.UNKNOWN_ID=-1;function hm(r,e){let t=r.toTimestamp().seconds,n=r.toTimestamp().nanoseconds+1,s=Z.fromTimestamp(n===1e9?new Te(t+1,0):new Te(t,n));return new Fn(s,Q.empty(),e)}function fm(r){return new Fn(r.readTime,r.key,ms)}var Fn=class r{constructor(e,t,n){this.readTime=e,this.documentKey=t,this.largestBatchId=n}static min(){return new r(Z.min(),Q.empty(),ms)}static max(){return new r(Z.max(),Q.empty(),ms)}};function dm(r,e){let t=r.readTime.compareTo(e.readTime);return t!==0?t:(t=Q.comparator(r.documentKey,e.documentKey),t!==0?t:ne(r.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var aB=class{constructor(e,t=null,n=[],s=[],i=null,a=null,B=null){this.path=e,this.collectionGroup=t,this.orderBy=n,this.filters=s,this.limit=i,this.startAt=a,this.endAt=B,this.R=null}};function Ff(r,e=null,t=[],n=[],s=null,i=null,a=null){return new aB(r,e,t,n,s,i,a)}function Ad(r){let e=Be(r);if(e.R===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map((n=>Za(n))).join(","),t+="|ob:",t+=e.orderBy.map((n=>(function(i){return i.field.canonicalString()+i.dir})(n))).join(","),yo(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map((n=>ur(n))).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map((n=>ur(n))).join(",")),e.R=t}return e.R}function bd(r,e){if(r.limit!==e.limit||r.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<r.orderBy.length;t++)if(!lm(r.orderBy[t],e.orderBy[t]))return!1;if(r.filters.length!==e.filters.length)return!1;for(let t=0;t<r.filters.length;t++)if(!wd(r.filters[t],e.filters[t]))return!1;return r.collectionGroup===e.collectionGroup&&!!r.path.isEqual(e.path)&&!!Nf(r.startAt,e.startAt)&&Nf(r.endAt,e.endAt)}function Dn(r){return!!r.isCorePipeline}function vd(r){return!!r.path&&Q.isDocumentKey(r.path)&&r.collectionGroup===null&&r.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var pr=class{constructor(e,t=null,n=[],s=[],i=null,a="F",B=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=n,this.filters=s,this.limit=i,this.limitType=a,this.startAt=B,this.endAt=u,this.I=null,this.A=null,this.V=null,this.startAt,this.endAt}};function Cm(r,e,t,n,s,i,a,B){return new pr(r,e,t,n,s,i,a,B)}function Io(r){return new pr(r)}function xf(r){return r.filters.length===0&&r.limit===null&&r.startAt==null&&r.endAt==null&&(r.explicitOrderBy.length===0||r.explicitOrderBy.length===1&&r.explicitOrderBy[0].field.isKeyField())}function pm(r){return Q.isDocumentKey(r.path)&&r.collectionGroup===null&&r.filters.length===0}function Sd(r){return r.collectionGroup!==null}function er(r){let e=Be(r);if(e.I===null){e.I=[];let t=new Set;for(let i of e.explicitOrderBy)e.I.push(i),t.add(i.field.canonicalString());let n=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(a){let B=new Re(Bt.comparator);return a.filters.forEach((u=>{u.getFlattenedFilters().forEach((l=>{l.isInequality()&&(B=B.add(l.field))}))})),B})(e).forEach((i=>{t.has(i.canonicalString())||i.isKeyField()||e.I.push(new Nn(i,n))})),t.has(Bt.keyField().canonicalString())||e.I.push(new Nn(Bt.keyField(),n))}return e.I}function _t(r){let e=Be(r);return e.A||(e.A=gm(e,er(r))),e.A}function gm(r,e){if(r.limitType==="F")return Ff(r.path,r.collectionGroup,e,r.filters,r.limit,r.startAt,r.endAt);{e=e.map((s=>{let i=s.dir==="desc"?"asc":"desc";return new Nn(s.field,i)}));let t=r.endAt?new Rn(r.endAt.position,r.endAt.inclusive):null,n=r.startAt?new Rn(r.startAt.position,r.startAt.inclusive):null;return Ff(r.path,r.collectionGroup,e,r.filters,r.limit,t,n)}}function Gi(r,e,t){return new pr(r.path,r.collectionGroup,r.explicitOrderBy.slice(),r.filters.slice(),e,t,r.startAt,r.endAt)}function mm(r,e){return bd(_t(r),_t(e))&&r.limitType===e.limitType}function os(r){return`Query(target=${(function(t){let n=t.path.canonicalString();return t.collectionGroup!==null&&(n+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(n+=`, filters: [${t.filters.map((s=>Id(s))).join(", ")}]`),yo(t.limit)||(n+=", limit: "+t.limit),t.orderBy.length>0&&(n+=`, orderBy: [${t.orderBy.map((s=>(function(a){return`${a.field.canonicalString()} (${a.dir})`})(s))).join(", ")}]`),t.startAt&&(n+=", startAt: ",n+=t.startAt.inclusive?"b:":"a:",n+=t.startAt.position.map((s=>ur(s))).join(",")),t.endAt&&(n+=", endAt: ",n+=t.endAt.inclusive?"a:":"b:",n+=t.endAt.position.map((s=>ur(s))).join(",")),`Target(${n})`})(_t(r))}; limitType=${r.limitType})`}function To(r,e){return e.isFoundDocument()&&(function(n,s){let i=s.key.path;return n.collectionGroup!==null?s.key.hasCollectionId(n.collectionGroup)&&n.path.isPrefixOf(i):Q.isDocumentKey(n.path)?n.path.isEqual(i):n.path.isImmediateParentOf(i)})(r,e)&&(function(n,s){for(let i of er(n))if(!i.field.isKeyField()&&s.data.field(i.field)===null)return!1;return!0})(r,e)&&(function(n,s){for(let i of n.filters)if(!i.matches(s))return!1;return!0})(r,e)&&(function(n,s){return!(n.startAt&&!(function(a,B,u){let l=Rf(a,B,u);return a.inclusive?l<=0:l<0})(n.startAt,er(n),s)||n.endAt&&!(function(a,B,u){let l=Rf(a,B,u);return a.inclusive?l>=0:l>0})(n.endAt,er(n),s))})(r,e)}function Pc(r){return(e,t)=>{let n=!1;for(let s of er(r)){let i=Em(s,e,t);if(i!==0)return i;n=n||s.field.isKeyField()}return 0}}function Em(r,e,t){let n=r.field.isKeyField()?Q.comparator(e.key,t.key):(function(i,a,B){let u=a.data.field(i),l=B.data.field(i);return u!==null&&l!==null?We(u,l):Y(42886)})(r.field,e,t);switch(r.dir){case"asc":return n;case"desc":return-1*n;default:return Y(19790,{direction:r.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var BB=class{constructor(e,t){this.count=e,this.unchangedNames=t}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var De,ae;function Rd(r){if(r===void 0)return xt("GRPC error has no .code"),M.UNKNOWN;switch(r){case De.OK:return M.OK;case De.CANCELLED:return M.CANCELLED;case De.UNKNOWN:return M.UNKNOWN;case De.DEADLINE_EXCEEDED:return M.DEADLINE_EXCEEDED;case De.RESOURCE_EXHAUSTED:return M.RESOURCE_EXHAUSTED;case De.INTERNAL:return M.INTERNAL;case De.UNAVAILABLE:return M.UNAVAILABLE;case De.UNAUTHENTICATED:return M.UNAUTHENTICATED;case De.INVALID_ARGUMENT:return M.INVALID_ARGUMENT;case De.NOT_FOUND:return M.NOT_FOUND;case De.ALREADY_EXISTS:return M.ALREADY_EXISTS;case De.PERMISSION_DENIED:return M.PERMISSION_DENIED;case De.FAILED_PRECONDITION:return M.FAILED_PRECONDITION;case De.ABORTED:return M.ABORTED;case De.OUT_OF_RANGE:return M.OUT_OF_RANGE;case De.UNIMPLEMENTED:return M.UNIMPLEMENTED;case De.DATA_LOSS:return M.DATA_LOSS;default:return Y(39323,{code:r})}}(ae=De||(De={}))[ae.OK=0]="OK",ae[ae.CANCELLED=1]="CANCELLED",ae[ae.UNKNOWN=2]="UNKNOWN",ae[ae.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",ae[ae.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",ae[ae.NOT_FOUND=5]="NOT_FOUND",ae[ae.ALREADY_EXISTS=6]="ALREADY_EXISTS",ae[ae.PERMISSION_DENIED=7]="PERMISSION_DENIED",ae[ae.UNAUTHENTICATED=16]="UNAUTHENTICATED",ae[ae.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",ae[ae.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",ae[ae.ABORTED=10]="ABORTED",ae[ae.OUT_OF_RANGE=11]="OUT_OF_RANGE",ae[ae.UNIMPLEMENTED=12]="UNIMPLEMENTED",ae[ae.INTERNAL=13]="INTERNAL",ae[ae.UNAVAILABLE=14]="UNAVAILABLE",ae[ae.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Lt=class{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){let t=this.mapKeyFn(e),n=this.inner[t];if(n!==void 0){for(let[s,i]of n)if(this.equalsFn(s,e))return i}}has(e){return this.get(e)!==void 0}set(e,t){let n=this.mapKeyFn(e),s=this.inner[n];if(s===void 0)return this.inner[n]=[[e,t]],void this.innerSize++;for(let i=0;i<s.length;i++)if(this.equalsFn(s[i][0],e))return void(s[i]=[e,t]);s.push([e,t]),this.innerSize++}delete(e){let t=this.mapKeyFn(e),n=this.inner[t];if(n===void 0)return!1;for(let s=0;s<n.length;s++)if(this.equalsFn(n[s][0],e))return n.length===1?delete this.inner[t]:n.splice(s,1),this.innerSize--,!0;return!1}forEach(e){vr(this.inner,((t,n)=>{for(let[s,i]of n)e(s,i)}))}isEmpty(){return od(this.inner)}size(){return this.innerSize}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var _m=new _e(Q.comparator);function rt(){return _m}var Nd=new _e(Q.comparator);function Qn(...r){let e=Nd;for(let t of r)e=e.insert(t.key,t);return e}function Dm(r){let e=Nd;return r.forEach(((t,n)=>e=e.insert(t,n.overlayedDocument))),e}function Wt(){return as()}function Fd(){return as()}function as(){return new Lt((r=>r.toString()),((r,e)=>r.isEqual(e)))}var ND=new _e(Q.comparator),ym=new Re(Q.comparator);function ie(...r){let e=ym;for(let t of r)e=e.add(t);return e}var wm=new Re(ne);function Im(){return wm}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Tm=null;/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Am(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var bm=new At([4294967295,4294967295],0);function Pf(r){let e=Am().encode(r),t=new Aa;return t.update(e),new Uint8Array(t.digest())}function Of(r){let e=new DataView(r.buffer),t=e.getUint32(0,!0),n=e.getUint32(4,!0),s=e.getUint32(8,!0),i=e.getUint32(12,!0);return[new At([t,n],0),new At([s,i],0)]}var uB=class r{constructor(e,t,n){if(this.bitmap=e,this.padding=t,this.hashCount=n,t<0||t>=8)throw new In(`Invalid padding: ${t}`);if(n<0)throw new In(`Invalid hash count: ${n}`);if(e.length>0&&this.hashCount===0)throw new In(`Invalid hash count: ${n}`);if(e.length===0&&t!==0)throw new In(`Invalid padding when bitmap length is 0: ${t}`);this.m=8*e.length-t,this.p=At.fromNumber(this.m)}S(e,t,n){let s=e.add(t.multiply(At.fromNumber(n)));return s.compare(bm)===1&&(s=new At([s.getBits(0),s.getBits(1)],0)),s.modulo(this.p).toNumber()}v(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.m===0)return!1;let t=Pf(e),[n,s]=Of(t);for(let i=0;i<this.hashCount;i++){let a=this.S(n,s,i);if(!this.v(a))return!1}return!0}static create(e,t,n){let s=e%8==0?0:8-e%8,i=new Uint8Array(Math.ceil(e/8)),a=new r(i,s,t);return n.forEach((B=>a.insert(B))),a}insert(e){if(this.m===0)return;let t=Pf(e),[n,s]=Of(t);for(let i=0;i<this.hashCount;i++){let a=this.S(n,s,i);this.D(a)}}D(e){let t=Math.floor(e/8),n=e%8;this.bitmap[t]|=1<<n}},In=class extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Es=class r{constructor(e,t,n,s,i,a){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=n,this.documentUpdates=s,this.augmentedDocumentUpdates=i,this.resolvedLimboDocuments=a}static createSynthesizedRemoteEventForCurrentChange(e,t,n){let s=new Map;return s.set(e,_s.createSynthesizedTargetChangeForCurrentChange(e,t,n)),new r(Z.min(),s,new _e(ne),rt(),rt(),ie())}},_s=class r{constructor(e,t,n,s,i){this.resumeToken=e,this.current=t,this.addedDocuments=n,this.modifiedDocuments=s,this.removedDocuments=i}static createSynthesizedTargetChangeForCurrentChange(e,t,n){return new r(n,t,ie(),ie(),ie())}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var tr=class{constructor(e,t,n,s){this.C=e,this.removedTargetIds=t,this.key=n,this.F=s}},Hi=class{constructor(e,t){this.targetId=e,this.O=t}},Ui=class{constructor(e,t,n=Ae.EMPTY_BYTE_STRING,s=null){this.state=e,this.targetIds=t,this.resumeToken=n,this.cause=s}},qi=class{constructor(e){this.targetId=e,this.M=0,this.N=Lf(),this.L=Ae.EMPTY_BYTE_STRING,this.B=!1,this.U=!0}get current(){return this.B}get resumeToken(){return this.L}get k(){return this.M!==0}get q(){return this.U}$(e){e.approximateByteSize()>0&&(this.U=!0,this.L=e)}K(){let e=ie(),t=ie(),n=ie();return this.N.forEach(((s,i)=>{switch(i){case 0:e=e.add(s);break;case 2:t=t.add(s);break;case 1:n=n.add(s);break;default:Y(38017,{changeType:i})}})),new _s(this.L,this.B,e,t,n)}W(){this.U=!1,this.N=Lf()}G(e,t){this.U=!0,this.N=this.N.insert(e,t)}j(e){this.U=!0,this.N=this.N.remove(e)}H(){this.M+=1}J(){this.M-=1,$(this.M>=0,3241,{M:this.M,targetId:this.targetId})}Y(){this.U=!0,this.B=!0}},ns="WatchChangeAggregator",cB=class{constructor(e){this.Z=e,this.X=new Map,this.ee=rt(),this.te=Ai(),this.ne=rt(),this.re=Ai(),this.ie=new _e(ne)}se(e){for(let t of e.C)e.F&&e.F.isFoundDocument()?this._e(t,e.F):this.oe(t,e.key,e.F);for(let t of e.removedTargetIds)this.oe(t,e.key,e.F)}ae(e){this.forEachTarget(e,(t=>{let n=this.X.get(t);if(n)switch(e.state){case 0:this.ue(t)&&n.$(e.resumeToken);break;case 1:n.J(),n.k||n.W(),n.$(e.resumeToken);break;case 2:n.J(),n.k||this.removeTarget(t);break;case 3:this.ue(t)&&(n.Y(),n.$(e.resumeToken));break;case 4:this.ue(t)&&(this.ce(t),n.$(e.resumeToken));break;default:Y(56790,{state:e.state})}else U(ns,`handleTargetChange received targetChange for untracked target ID (${t}) with state (${e.state})`)}))}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.X.forEach(((n,s)=>{this.ue(s)&&t(s)}))}le(e){return Dn(e)?e.getPipelineSourceType()==="documents"&&e.getPipelineDocuments()?.length===1:vd(e)}Ee(e){let t=e.targetId,n=e.O.count,s=this.he(t);if(s){let i=s.target;if(this.le(i))if(n===0){let a=new Q(Dn(i)?le.fromString(i.getPipelineDocuments()[0]):i.path);this.oe(t,a,dt.newNoDocument(a,Z.min()))}else $(n===1,20013,"Single document existence filter with count: "+n);else{let a=this.Te(t);if(a!==n){let B=this.Pe(e),u=B?this.Re(B,e,a):1;if(u!==0){this.ce(t);let l=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.ie=this.ie.insert(t,l)}Tm?.Ie((function(f,C,D,v,R){let V={localCacheCount:f,existenceFilterCount:C.count,databaseId:D.database,projectId:D.projectId},H=C.unchangedNames;return H&&(V.bloomFilter={applied:R===0,hashCount:H?.hashCount??0,bitmapLength:H?.bits?.bitmap?.length??0,padding:H?.bits?.padding??0,mightContain:z=>v?.mightContain(z)??!1}),V})(a,e.O,this.Z.Ae(),B,u))}}}}Pe(e){let t=e.O.unchangedNames;if(!t||!t.bits)return null;let{bits:{bitmap:n="",padding:s=0},hashCount:i=0}=t,a,B;try{a=Ot(n).toUint8Array()}catch(u){if(u instanceof Pi)return ut("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{B=new uB(a,s,i)}catch(u){return ut(u instanceof In?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return B.m===0?null:B}Re(e,t,n){return t.O.count===n-this.Ve(e,t.targetId)?0:2}Ve(e,t){let n=this.Z.getRemoteKeysForTarget(t),s=0;return n.forEach((i=>{let a=this.Z.Ae(),B=`projects/${a.projectId}/databases/${a.database}/documents/${i.path.canonicalString()}`;e.mightContain(B)||(this.oe(t,i,null),s++)})),s}de(e){let t=new Map;this.X.forEach(((i,a)=>{let B=this.he(a);if(B){if(i.current&&this.le(B.target)){let u=Dn(B.target)?le.fromString(B.target.getPipelineDocuments()[0]):B.target.path,l=new Q(u);this.fe(l).has(a)||this.me(a,l)||this.oe(a,l,dt.newNoDocument(l,e))}i.q&&(t.set(a,i.K()),i.W())}}));let n=ie();this.re.forEach(((i,a)=>{let B=!0;a.forEachWhile((u=>{let l=this.he(u);return!l||l.purpose==="TargetPurposeLimboResolution"||(B=!1,!1)})),B&&(n=n.add(i))})),this.ee.forEach(((i,a)=>a.setReadTime(e))),this.ne.forEach(((i,a)=>a.setReadTime(e)));let s=new Es(e,t,this.ie,this.ee,this.ne,n);return this.ee=rt(),this.te=Ai(),this.ne=rt(),this.re=Ai(),this.ie=new _e(ne),s}_e(e,t){let n=this.X.get(e);if(!n||!this.ue(e))return void U(ns,`addDocumentToTarget received document for unknown inactive target (${e})`);let s=this.me(e,t.key)?2:0;n.G(t.key,s),Dn(this.he(e).target)&&this.he(e).target.getPipelineFlavor()!=="exact"?this.ne=this.ne.insert(t.key,t):this.ee=this.ee.insert(t.key,t),this.te=this.te.insert(t.key,this.fe(t.key).add(e)),this.re=this.re.insert(t.key,this.pe(t.key).add(e))}oe(e,t,n){let s=this.X.get(e);s&&this.ue(e)?(this.me(e,t)?s.G(t,1):s.j(t),this.re=this.re.insert(t,this.pe(t).delete(e)),this.re=this.re.insert(t,this.pe(t).add(e)),n&&(Dn(this.he(e).target)&&this.he(e).target.getPipelineFlavor()!=="exact"?this.ne=this.ne.insert(t,n):this.ee=this.ee.insert(t,n))):U(ns,`removeDocumentFromTarget received document for unknown or inactive target (${e})`)}removeTarget(e){this.X.delete(e)}Te(e){let t=this.X.get(e);if(!t)return 0;let n=t.K();return this.Z.getRemoteKeysForTarget(e).size+n.addedDocuments.size-n.removedDocuments.size}H(e){let t=this.X.get(e);t||(U(ns,`recordPendingTargetRequest set up tracking for target ID ${e}`),t=new qi(e),this.X.set(e,t)),t.H()}pe(e){let t=this.re.get(e);return t||(t=new Re(ne),this.re=this.re.insert(e,t)),t}fe(e){let t=this.te.get(e);return t||(t=new Re(ne),this.te=this.te.insert(e,t)),t}ue(e){let t=this.he(e)!==null;return t||U(ns,"Detected inactive target",e),t}he(e){let t=this.X.get(e);return t===void 0||t.k?null:this.Z.ge(e)}ce(e){this.X.set(e,new qi(e)),this.Z.getRemoteKeysForTarget(e).forEach((t=>{this.oe(e,t,null)}))}me(e,t){return this.Z.getRemoteKeysForTarget(e).has(t)}};function Ai(){return new _e(Q.comparator)}function Lf(){return new _e(Q.comparator)}var vm={asc:"ASCENDING",desc:"DESCENDING"},Sm={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},Rm={and:"AND",or:"OR"},lB=class{constructor(e,t){this.databaseId=e,this.useProto3Json=t}};function hB(r,e){return r.useProto3Json||yo(e)?e:{value:e}}function ji(r,e){return r.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Oc(r){let e=Pt(r);return new Te(e.seconds,e.nanos)}function xd(r,e){return r.useProto3Json?e.toBase64():e.toUint8Array()}function Ua(r,e){return ji(r,e.toTimestamp())}function nr(r){return $(!!r,49232),Z.fromTimestamp(Oc(r))}function Lc(r,e){return fB(r,e).canonicalString()}function fB(r,e){let t=(function(s){return new le(["projects",s.projectId,"databases",s.database])})(r).child("documents");return e===void 0?t:t.child(e)}function Pd(r){let e=le.fromString(r);return $(Md(e),10190,{key:e.toString()}),e}function Nm(r,e){return Lc(r.databaseId,e.path)}function qa(r,e){let t=Pd(e);if(t.get(1)!==r.databaseId.projectId)throw new j(M.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+r.databaseId.projectId);if(t.get(3)!==r.databaseId.database)throw new j(M.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+r.databaseId.database);return new Q(Ld(t))}function Od(r,e){return Lc(r.databaseId,e)}function Fm(r){let e=Pd(r);return e.length===4?le.emptyPath():Ld(e)}function Vf(r){return new le(["projects",r.databaseId.projectId,"databases",r.databaseId.database]).canonicalString()}function Ld(r){return $(r.length>4&&r.get(4)==="documents",29091,{key:r.toString()}),r.popFirst(5)}function xm(r,e){let t;if("targetChange"in e){e.targetChange;let n=(function(l){return l==="NO_CHANGE"?0:l==="ADD"?1:l==="REMOVE"?2:l==="CURRENT"?3:l==="RESET"?4:Y(39313,{state:l})})(e.targetChange.targetChangeType||"NO_CHANGE"),s=e.targetChange.targetIds||[],i=(function(l,f){return l.useProto3Json?($(f===void 0||typeof f=="string",58123),Ae.fromBase64String(f||"")):($(f===void 0||f instanceof Buffer||f instanceof Uint8Array,16193),Ae.fromUint8Array(f||new Uint8Array))})(r,e.targetChange.resumeToken),a=e.targetChange.cause,B=a&&(function(l){let f=l.code===void 0?M.UNKNOWN:Rd(l.code);return new j(f,l.message||"")})(a);t=new Ui(n,s,i,B||null)}else if("documentChange"in e){e.documentChange;let n=e.documentChange;n.document,n.document.name,n.document.updateTime;let s=qa(r,n.document.name),i=nr(n.document.updateTime),a=n.document.createTime?nr(n.document.createTime):Z.min(),B=new ht({mapValue:{fields:n.document.fields}}),u=dt.newFoundDocument(s,i,a,B),l=n.targetIds||[],f=n.removedTargetIds||[];t=new tr(l,f,u.key,u)}else if("documentDelete"in e){e.documentDelete;let n=e.documentDelete;n.document;let s=qa(r,n.document),i=n.readTime?nr(n.readTime):Z.min(),a=dt.newNoDocument(s,i),B=n.removedTargetIds||[];t=new tr([],B,a.key,a)}else if("documentRemove"in e){e.documentRemove;let n=e.documentRemove;n.document;let s=qa(r,n.document),i=n.removedTargetIds||[];t=new tr([],i,s,null)}else{if(!("filter"in e))return Y(11601,{ye:e});{e.filter;let n=e.filter;n.targetId;let{count:s=0,unchangedNames:i}=n,a=new BB(s,i),B=n.targetId;t=new Hi(B,a)}}return t}function Pm(r,e){return{documents:[Od(r,e.path)]}}function Om(r,e){let t={structuredQuery:{}},n=e.path,s;e.collectionGroup!==null?(s=n,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(s=n.popLast(),t.structuredQuery.from=[{collectionId:n.lastSegment()}]),t.parent=Od(r,s);let i=(function(l){if(l.length!==0)return kd(ft.create(l,"and"))})(e.filters);i&&(t.structuredQuery.where=i);let a=(function(l){if(l.length!==0)return l.map((f=>(function(D){return{field:$n(D.field),direction:Mm(D.dir)}})(f)))})(e.orderBy);a&&(t.structuredQuery.orderBy=a);let B=hB(r,e.limit);return B!==null&&(t.structuredQuery.limit=B),e.startAt&&(t.structuredQuery.startAt=(function(l){return{before:l.inclusive,values:l.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(l){return{before:!l.inclusive,values:l.position}})(e.endAt)),{be:t,parent:s}}function Lm(r){let e=Fm(r.parent),t=r.structuredQuery,n=t.from?t.from.length:0,s=null;if(n>0){$(n===1,65062);let f=t.from[0];f.allDescendants?s=f.collectionId:e=e.child(f.collectionId)}let i=[];t.where&&(i=(function(C){let D=Vd(C);return D instanceof ft&&yd(D)?D.getFilters():[D]})(t.where));let a=[];t.orderBy&&(a=(function(C){return C.map((D=>(function(R){return new Nn(Wn(R.field),(function(H){switch(H){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(R.direction))})(D)))})(t.orderBy));let B=null;t.limit&&(B=(function(C){let D;return D=typeof C=="object"?C.value:C,yo(D)?null:D})(t.limit));let u=null;t.startAt&&(u=(function(C){let D=!!C.before,v=C.values||[];return new Rn(v,D)})(t.startAt));let l=null;return t.endAt&&(l=(function(C){let D=!C.before,v=C.values||[];return new Rn(v,D)})(t.endAt)),Cm(e,s,a,i,B,"F",u,l)}function Vm(r,e){let t=(function(s){switch(s){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return Y(28987,{purpose:s})}})(e.purpose);return t==null?null:{"goog-listen-tags":t}}function km(r,e){return{structuredPipeline:{pipeline:{stages:e.stages.map((t=>t._toProto(r)))}}}}function Vd(r){return r.unaryFilter!==void 0?(function(t){switch(t.unaryFilter.op){case"IS_NAN":let n=Wn(t.unaryFilter.field);return we.create(n,"==",{doubleValue:NaN});case"IS_NULL":let s=Wn(t.unaryFilter.field);return we.create(s,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":let i=Wn(t.unaryFilter.field);return we.create(i,"!=",{doubleValue:NaN});case"IS_NOT_NULL":let a=Wn(t.unaryFilter.field);return we.create(a,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return Y(61313);default:return Y(60726)}})(r):r.fieldFilter!==void 0?(function(t){return we.create(Wn(t.fieldFilter.field),(function(s){switch(s){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return Y(58110);default:return Y(50506)}})(t.fieldFilter.op),t.fieldFilter.value)})(r):r.compositeFilter!==void 0?(function(t){return ft.create(t.compositeFilter.filters.map((n=>Vd(n))),(function(s){switch(s){case"AND":return"and";case"OR":return"or";default:return Y(1026)}})(t.compositeFilter.op))})(r):Y(30097,{filter:r})}function Mm(r){return vm[r]}function Gm(r){return Sm[r]}function Hm(r){return Rm[r]}function $n(r){return{fieldPath:r.canonicalString()}}function Wn(r){return Bt.fromServerFormat(r.fieldPath)}function kd(r){return r instanceof we?(function(t){if(t.op==="=="){if(Ye(t.value))return{unaryFilter:{field:$n(t.field),op:"IS_NAN"}};if(nt(t.value))return{unaryFilter:{field:$n(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Ye(t.value))return{unaryFilter:{field:$n(t.field),op:"IS_NOT_NAN"}};if(nt(t.value))return{unaryFilter:{field:$n(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:$n(t.field),op:Gm(t.op),value:t.value}}})(r):r instanceof ft?(function(t){let n=t.getFilters().map((s=>kd(s)));return n.length===1?n[0]:{compositeFilter:{op:Hm(t.op),filters:n}}})(r):Y(54877,{filter:r})}function Md(r){return r.length>=4&&r.get(0)==="projects"&&r.get(2)==="databases"}function Gd(r){return!!r&&typeof r._toProto=="function"&&r._protoValueType==="ProtoValue"}function Ds(r,e){let t={fields:{}};return e.forEach(((n,s)=>{if(typeof s!="string")throw new Error(`Cannot encode map with non-string key: ${s}`);t.fields[s]=n._toProto(r)})),{mapValue:t}}function Hd(r){return{stringValue:r}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ud(r){return new lB(r,!0)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var St=class r{constructor(e){this._byteString=e}static fromBase64String(e){try{return new r(Ae.fromBase64String(e))}catch(t){throw new j(M.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new r(Ae.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:r._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(Us(e,r._jsonSchema))return r.fromBase64String(e.bytes)}};St._jsonSchemaVersion="firestore/bytes/1.0",St._jsonSchema={type:Ie("string",St._jsonSchemaVersion),bytes:Ie("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var gr=class{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new j(M.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Bt(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}};function qd(){return new gr(ir)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ys=class{constructor(e){this._methodName=e}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Rt=class r{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new j(M.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new j(M.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return ne(this._lat,e._lat)||ne(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:r._jsonSchemaVersion}}static fromJSON(e){if(Us(e,r._jsonSchema))return new r(e.latitude,e.longitude)}};Rt._jsonSchemaVersion="firestore/geoPoint/1.0",Rt._jsonSchema={type:Ie("string",Rt._jsonSchemaVersion),latitude:Ie("number"),longitude:Ie("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var xe=class{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}};xe.UNAUTHENTICATED=new xe(null),xe.GOOGLE_CREDENTIALS=new xe("google-credentials-uid"),xe.FIRST_PARTY=new xe("first-party-uid"),xe.MOCK_USER=new xe("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Xt=class{constructor(){this.promise=new Promise(((e,t)=>{this.resolve=e,this.reject=t}))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ji=class{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}},Ki=class{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(xe.UNAUTHENTICATED)))}shutdown(){}},dB=class{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}},zi=class{constructor(e){this.ve=e,this.currentUser=xe.UNAUTHENTICATED,this.De=0,this.forceRefresh=!1,this.auth=null}start(e,t){$(this.xe===void 0,42304);let n=this.De,s=u=>this.De!==n?(n=this.De,t(u)):Promise.resolve(),i=new Xt;this.xe=()=>{this.De++,this.currentUser=this.Ce(),i.resolve(),i=new Xt,e.enqueueRetryable((()=>s(this.currentUser)))};let a=()=>{let u=i;e.enqueueRetryable((async()=>{await u.promise,await s(this.currentUser)}))},B=u=>{U("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.xe&&(this.auth.addAuthTokenListener(this.xe),a())};this.ve.onInit((u=>B(u))),setTimeout((()=>{if(!this.auth){let u=this.ve.getImmediate({optional:!0});u?B(u):(U("FirebaseAuthCredentialsProvider","Auth not yet detected"),i.resolve(),i=new Xt)}}),0),a()}getToken(){let e=this.De,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then((n=>this.De!==e?(U("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):n?($(typeof n.accessToken=="string",31837,{Fe:n}),new Ji(n.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.xe&&this.auth.removeAuthTokenListener(this.xe),this.xe=void 0}Ce(){let e=this.auth&&this.auth.getUid();return $(e===null||typeof e=="string",2055,{Oe:e}),new xe(e)}},CB=class{constructor(e,t,n){this.Me=e,this.Ne=t,this.Le=n,this.type="FirstParty",this.user=xe.FIRST_PARTY,this.Be=new Map}Ue(){return this.Le?this.Le():null}get headers(){this.Be.set("X-Goog-AuthUser",this.Me);let e=this.Ue();return e&&this.Be.set("Authorization",e),this.Ne&&this.Be.set("X-Goog-Iam-Authorization-Token",this.Ne),this.Be}},pB=class{constructor(e,t,n){this.Me=e,this.Ne=t,this.Le=n}getToken(){return Promise.resolve(new CB(this.Me,this.Ne,this.Le))}start(e,t){e.enqueueRetryable((()=>t(xe.FIRST_PARTY)))}shutdown(){}invalidateToken(){}},Qi=class{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}},$i=class{constructor(e,t){this.ke=t,this.forceRefresh=!1,this.appCheck=null,this.qe=null,this.$e=null,Ah(e)&&e.settings.appCheckToken&&(this.$e=e.settings.appCheckToken)}start(e,t){$(this.xe===void 0,3512);let n=i=>{i.error!=null&&U("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${i.error.message}`);let a=i.token!==this.qe;return this.qe=i.token,U("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?t(i.token):Promise.resolve()};this.xe=i=>{e.enqueueRetryable((()=>n(i)))};let s=i=>{U("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=i,this.xe&&this.appCheck.addTokenListener(this.xe)};this.ke.onInit((i=>s(i))),setTimeout((()=>{if(!this.appCheck){let i=this.ke.getImmediate({optional:!0});i?s(i):U("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){if(this.$e)return Promise.resolve(new Qi(this.$e));let e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((t=>t?($(typeof t.token=="string",44558,{tokenResult:t}),this.qe=t.token,new Qi(t.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.xe&&this.appCheck.removeTokenListener(this.xe),this.xe=void 0}};function jd(r){let e={};return r.timeoutSeconds!==void 0&&(e.timeoutSeconds=r.timeoutSeconds),e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var gB=class{Ke(e){}shutdown(){}};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var kf="ConnectivityMonitor",Wi=class{constructor(){this.Qe=()=>this.We(),this.Ge=()=>this.ze(),this.je=[],this.He()}Ke(e){this.je.push(e)}shutdown(){window.removeEventListener("online",this.Qe),window.removeEventListener("offline",this.Ge)}He(){window.addEventListener("online",this.Qe),window.addEventListener("offline",this.Ge)}We(){U(kf,"Network connectivity changed: AVAILABLE");for(let e of this.je)e(0)}ze(){U(kf,"Network connectivity changed: UNAVAILABLE");for(let e of this.je)e(1)}static Je(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}};/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var bi=null;function mB(){return bi===null?bi=(function(){return 268435456+Math.round(2147483648*Math.random())})():bi++,"0x"+bi.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ja="RestConnection",Um={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"},EB=class{get Ye(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;let t=e.ssl?"https":"http",n=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.Ze=t+"://"+e.host,this.Xe=`projects/${n}/databases/${s}`,this.et=this.databaseId.database===Oi?`project_id=${n}`:`project_id=${n}&database_id=${s}`}tt(e,t,n,s,i){let a=mB(),B=this.nt(e,t.toUriEncodedString());U(ja,`Sending RPC '${e}' ${a}:`,B,n);let u={"google-cloud-resource-prefix":this.Xe,"x-goog-request-params":this.et};this.rt(u,s,i);let{host:l}=new URL(B),f=ua(l);return this.it(e,B,u,n,f).then((C=>(U(ja,`Received RPC '${e}' ${a}: `,C),C)),(C=>{throw ut(ja,`RPC '${e}' ${a} failed with error: `,C,"url: ",B,"request:",n),C}))}st(e,t,n,s,i,a){return this.tt(e,t,n,s,i)}rt(e,t,n){if(e["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+br})(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach(((s,i)=>e[i]=s)),n&&n.headers.forEach(((s,i)=>e[i]=s)),this.databaseInfo._customHeaders)for(let s of Object.keys(this.databaseInfo._customHeaders))e[s]=this.databaseInfo._customHeaders[s]}nt(e,t){let n=Um[e],s=`${this.Ze}/v1/${t}:${n}`;return this.databaseInfo.apiKey&&(s=`${s}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),s}terminate(){}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var _B=class{constructor(e){this._t=e._t,this.ot=e.ot}ut(e){this.ct=e}lt(e){this.Et=e}ht(e){this.Tt=e}onMessage(e){this.Pt=e}close(){this.ot()}send(e){this._t(e)}Rt(){this.ct()}It(){this.Et()}At(e){this.Tt(e)}Vt(e){this.Pt(e)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Me="WebChannelConnection",rs=(r,e,t)=>{r.listen(e,(n=>{try{t(n)}catch(s){setTimeout((()=>{throw s}),0)}}))},Yi=class r extends EB{constructor(e){super(e),this.dt=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}static ft(){if(!r.gt){let e=Ra();rs(e,Sa.STAT_EVENT,(t=>{t.stat===gi.PROXY?U(Me,"STAT_EVENT: detected buffering proxy"):t.stat===gi.NOPROXY&&U(Me,"STAT_EVENT: detected no buffering proxy")})),r.gt=!0}}it(e,t,n,s,i){let a=mB();return new Promise(((B,u)=>{let l=new ba;l.setWithCredentials(!0),l.listenOnce(va.COMPLETE,(()=>{try{switch(l.getLastErrorCode()){case Yr.NO_ERROR:let C=l.getResponseJson();U(Me,`XHR for RPC '${e}' ${a} received:`,JSON.stringify(C)),B(C);break;case Yr.TIMEOUT:U(Me,`RPC '${e}' ${a} timed out`),u(new j(M.DEADLINE_EXCEEDED,"Request time out"));break;case Yr.HTTP_ERROR:let D=l.getStatus();if(U(Me,`RPC '${e}' ${a} failed with status:`,D,"response text:",l.getResponseText()),D>0){let v=l.getResponseJson();Array.isArray(v)&&(v=v[0]);let R=v?.error;if(R&&R.status&&R.message){let V=(function(z){let re=z.toLowerCase().replace(/_/g,"-");return Object.values(M).indexOf(re)>=0?re:M.UNKNOWN})(R.status);u(new j(V,R.message))}else u(new j(M.UNKNOWN,"Server responded with status "+l.getStatus()))}else u(new j(M.UNAVAILABLE,"Connection failed."));break;default:Y(9055,{yt:e,streamId:a,wt:l.getLastErrorCode(),bt:l.getLastError()})}}finally{U(Me,`RPC '${e}' ${a} completed.`)}}));let f=JSON.stringify(s);U(Me,`RPC '${e}' ${a} sending request:`,s),l.send(t,"POST",f,n,15)}))}St(e,t,n){let s=mB(),i=[this.Ze,"/","google.firestore.v1.Firestore","/",e,"/channel"],a=this.createWebChannelTransport(),B={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},u=this.longPollingOptions.timeoutSeconds;u!==void 0&&(B.longPollingTimeout=Math.round(1e3*u)),this.useFetchStreams&&(B.useFetchStreams=!0),this.rt(B.initMessageHeaders,t,n),B.encodeInitMessageHeaders=!0;let l=i.join("");U(Me,`Creating RPC '${e}' stream ${s}: ${l}`,B);let f=a.createWebChannel(l,B);this.vt(f);let C=!1,D=!1,v=new _B({_t:R=>{D?U(Me,`Not sending because RPC '${e}' stream ${s} is closed:`,R):(C||(U(Me,`Opening RPC '${e}' stream ${s} transport.`),f.open(),C=!0),U(Me,`RPC '${e}' stream ${s} sending:`,R),f.send(R))},ot:()=>f.close()});return rs(f,qn.EventType.OPEN,(()=>{D||(U(Me,`RPC '${e}' stream ${s} transport opened.`),v.Rt())})),rs(f,qn.EventType.CLOSE,(()=>{D||(D=!0,U(Me,`RPC '${e}' stream ${s} transport closed`),v.At(),this.Dt(f))})),rs(f,qn.EventType.ERROR,(R=>{D||(D=!0,ut(Me,`RPC '${e}' stream ${s} transport errored. Name:`,R.name,"Message:",R.message),v.At(new j(M.UNAVAILABLE,"The operation could not be completed")))})),rs(f,qn.EventType.MESSAGE,(R=>{if(!D){let V=R.data[0];$(!!V,16349);let H=V,z=H?.error||H[0]?.error;if(z){U(Me,`RPC '${e}' stream ${s} received error:`,z);let re=z.status,ce=(function(me){let I=De[me];if(I!==void 0)return Rd(I)})(re),ee=z.message;re==="NOT_FOUND"&&ee.includes("database")&&ee.includes("does not exist")&&ee.includes(this.databaseId.database)&&ut(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),ce===void 0&&(ce=M.INTERNAL,ee="Unknown error status: "+re+" with message "+z.message),D=!0,v.At(new j(ce,ee)),f.close()}else U(Me,`RPC '${e}' stream ${s} received:`,V),v.Vt(V)}})),r.ft(),setTimeout((()=>{v.It()}),0),v}terminate(){this.dt.forEach((e=>e.close())),this.dt=[]}vt(e){this.dt.push(e)}Dt(e){this.dt=this.dt.filter((t=>t===e))}rt(e,t,n){super.rt(e,t,n),this.databaseInfo.apiKey&&(e["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return Na()}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qm(r){return new Yi(r)}Yi.gt=!1;var Xi=class{constructor(e,t,n=1e3,s=1.5,i=6e4){this.xt=e,this.timerId=t,this.Ct=n,this.Ft=s,this.Ot=i,this.Mt=0,this.Nt=null,this.Lt=Date.now(),this.reset()}reset(){this.Mt=0}Bt(){this.Mt=this.Ot}Ut(e){this.cancel();let t=Math.floor(this.Mt+this.kt()),n=Math.max(0,Date.now()-this.Lt),s=Math.max(0,t-n);s>0&&U("ExponentialBackoff",`Backing off for ${s} ms (base delay: ${this.Mt} ms, delay with jitter: ${t} ms, last attempt: ${n} ms ago)`),this.Nt=this.xt.enqueueAfterDelay(this.timerId,s,(()=>(this.Lt=Date.now(),e()))),this.Mt*=this.Ft,this.Mt<this.Ct&&(this.Mt=this.Ct),this.Mt>this.Ot&&(this.Mt=this.Ot)}qt(){this.Nt!==null&&(this.Nt.skipDelay(),this.Nt=null)}cancel(){this.Nt!==null&&(this.Nt.cancel(),this.Nt=null)}kt(){return(Math.random()-.5)*this.Mt}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Mf="PersistentStream",DB=class{constructor(e,t,n,s,i,a,B,u){this.xt=e,this.$t=n,this.Kt=s,this.connection=i,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=B,this.listener=u,this.state=0,this.Qt=0,this.Wt=null,this.Gt=null,this.stream=null,this.zt=0,this.jt=new Xi(e,t)}Ht(){return this.state===1||this.state===5||this.Jt()}Jt(){return this.state===2||this.state===3}start(){this.zt=0,this.state!==4?this.auth():this.Yt()}async stop(){this.Ht()&&await this.close(0)}Zt(){this.state=0,this.jt.reset()}Xt(){this.Jt()&&this.Wt===null&&(this.Wt=this.xt.enqueueAfterDelay(this.$t,6e4,(()=>this.en())))}tn(e){this.nn(),this.stream.send(e)}async en(){if(this.Jt())return this.close(0)}nn(){this.Wt&&(this.Wt.cancel(),this.Wt=null)}rn(){this.Gt&&(this.Gt.cancel(),this.Gt=null)}async close(e,t){this.nn(),this.rn(),this.jt.cancel(),this.Qt++,e!==4?this.jt.reset():t&&t.code===M.RESOURCE_EXHAUSTED?(xt(t.toString()),xt("Using maximum backoff delay to prevent overloading the backend."),this.jt.Bt()):t&&t.code===M.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.sn(),this.stream.close(),this.stream=null),this.state=e,await this.listener.ht(t)}sn(){}auth(){this.state=1;let e=this._n(this.Qt),t=this.Qt;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([n,s])=>{this.Qt===t&&this.an(n,s)}),(n=>{e((()=>{let s=new j(M.UNKNOWN,"Fetching auth token failed: "+n.message);return this.un(s)}))}))}an(e,t){let n=this._n(this.Qt);this.stream=this.cn(e,t),this.stream.ut((()=>{n((()=>this.listener.ut()))})),this.stream.lt((()=>{n((()=>(this.state=2,this.Gt=this.xt.enqueueAfterDelay(this.Kt,1e4,(()=>(this.Jt()&&(this.state=3),Promise.resolve()))),this.listener.lt())))})),this.stream.ht((s=>{n((()=>this.un(s)))})),this.stream.onMessage((s=>{n((()=>++this.zt==1?this.En(s):this.onNext(s)))}))}Yt(){this.state=5,this.jt.Ut((async()=>{this.state=0,this.start()}))}un(e){return U(Mf,`close with error: ${e}`),this.stream=null,this.close(4,e)}_n(e){return t=>{this.xt.enqueueAndForget((()=>this.Qt===e?t():(U(Mf,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}},yB=class extends DB{constructor(e,t,n,s,i,a){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,n,s,a),this.serializer=i}cn(e,t){return this.connection.St("Listen",e,t)}En(e){return this.onNext(e)}onNext(e){this.jt.reset();let t=xm(this.serializer,e),n=(function(i){if(!("targetChange"in i))return Z.min();let a=i.targetChange;return a.targetIds&&a.targetIds.length?Z.min():a.readTime?nr(a.readTime):Z.min()})(e);return this.listener.hn(t,n)}Tn(e){let t={};t.database=Vf(this.serializer),t.addTarget=(function(i,a){let B,u=a.target;if(B=Dn(u)?{pipelineQuery:km(i,u)}:vd(u)?{documents:Pm(i,u)}:{query:Om(i,u).be},B.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){B.resumeToken=xd(i,a.resumeToken);let l=hB(i,a.expectedCount);l!==null&&(B.expectedCount=l)}else if(a.snapshotVersion.compareTo(Z.min())>0){B.readTime=ji(i,a.snapshotVersion.toTimestamp());let l=hB(i,a.expectedCount);l!==null&&(B.expectedCount=l)}return B})(this.serializer,e);let n=Vm(this.serializer,e);n&&(t.labels=n),this.tn(t)}Pn(e){let t={};t.database=Vf(this.serializer),t.removeTarget=e,this.tn(t)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var wB=class{},IB=class extends wB{constructor(e,t,n,s){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=n,this.serializer=s,this.fn=!1}mn(){if(this.fn)throw new j(M.FAILED_PRECONDITION,"The client has already been terminated.")}tt(e,t,n,s){return this.mn(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([i,a])=>this.connection.tt(e,fB(t,n),s,i,a))).catch((i=>{throw i.name==="FirebaseError"?(i.code===M.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),i):new j(M.UNKNOWN,i.toString())}))}st(e,t,n,s,i){return this.mn(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([a,B])=>this.connection.st(e,fB(t,n),s,a,B,i))).catch((a=>{throw a.name==="FirebaseError"?(a.code===M.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new j(M.UNKNOWN,a.toString())}))}terminate(){this.fn=!0,this.connection.terminate()}};function jm(r,e,t,n){return new IB(r,e,t,n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Jm="ComponentProvider",Gf=new Map;function Km(r,e,t,n,s){return new Wa(r,e,t,s.host,s.ssl,s.experimentalForceLongPolling,s.experimentalAutoDetectLongPolling,jd(s.experimentalLongPollingOptions),s.useFetchStreams,s.isUsingEmulator,n,s._customHeaders,s.grpcFlowControlWindow)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Hf={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},Jd=41943040,at=class r{static withCacheSize(e){return new r(e,r.DEFAULT_COLLECTION_PERCENTILE,r.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,n){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=n}};at.DEFAULT_COLLECTION_PERCENTILE=10,at.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,at.DEFAULT=new at(Jd,at.DEFAULT_COLLECTION_PERCENTILE,at.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),at.DISABLED=new at(-1,0,0);/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var mr=class{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=n=>this.pn(n),this.gn=n=>t.writeSequenceNumber(n))}pn(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){let e=++this.previousValue;return this.gn&&this.gn(e),e}};mr.yn=-1;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var zm="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.",TB=class{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ao(r){if(r.code!==M.FAILED_PRECONDITION||r.message!==zm)throw r;U("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var L=class r{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)}),(t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)}))}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&Y(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new r(((n,s)=>{this.nextCallback=i=>{this.wrapSuccess(e,i).next(n,s)},this.catchCallback=i=>{this.wrapFailure(t,i).next(n,s)}}))}toPromise(){return new Promise(((e,t)=>{this.next(e,t)}))}wrapUserFunction(e){try{let t=e();return t instanceof r?t:r.resolve(t)}catch(t){return r.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction((()=>e(t))):r.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction((()=>e(t))):r.reject(t)}static resolve(e){return new r(((t,n)=>{t(e)}))}static reject(e){return new r(((t,n)=>{n(e)}))}static waitFor(e){return new r(((t,n)=>{let s=0,i=0,a=!1;e.forEach((B=>{++s,B.next((()=>{++i,a&&i===s&&t()}),(u=>n(u)))})),a=!0,i===s&&t()}))}static or(e){let t=r.resolve(!1);for(let n of e)t=t.next((s=>s?r.resolve(s):n()));return t}static forEach(e,t){let n=[];return e.forEach(((s,i)=>{n.push(t.call(this,s,i))})),this.waitFor(n)}static mapArray(e,t){return new r(((n,s)=>{let i=e.length,a=new Array(i),B=0;for(let u=0;u<i;u++){let l=u;t(e[l]).next((f=>{a[l]=f,++B,B===i&&n(a)}),(f=>s(f)))}}))}static doWhile(e,t){return new r(((n,s)=>{let i=()=>{e()===!0?t().next((()=>{i()}),s):n()};i()}))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qm(r){let e=r.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}function Sr(r){return r.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Uf="LruGarbageCollector",$m=1048576;function qf([r,e],[t,n]){let s=ne(r,t);return s===0?ne(e,n):s}var AB=class{constructor(e){this.Jn=e,this.buffer=new Re(qf),this.Yn=0}Zn(){return++this.Yn}Xn(e){let t=[e,this.Zn()];if(this.buffer.size<this.Jn)this.buffer=this.buffer.add(t);else{let n=this.buffer.last();qf(t,n)<0&&(this.buffer=this.buffer.delete(n).add(t))}}get maxValue(){return this.buffer.last()[0]}},bB=class{constructor(e,t,n){this.garbageCollector=e,this.asyncQueue=t,this.localStore=n,this.er=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.tr(6e4)}stop(){this.er&&(this.er.cancel(),this.er=null)}get started(){return this.er!==null}tr(e){U(Uf,`Garbage collection scheduled in ${e}ms`),this.er=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,(async()=>{this.er=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Sr(t)?U(Uf,"Ignoring IndexedDB error during garbage collection: ",t):await Ao(t)}await this.tr(3e5)}))}},vB=class{constructor(e,t){this.nr=e,this.params=t}calculateTargetCount(e,t){return this.nr.rr(e).next((n=>Math.floor(t/100*n)))}nthSequenceNumber(e,t){if(t===0)return L.resolve(mr.yn);let n=new AB(t);return this.nr.forEachTarget(e,(s=>n.Xn(s.sequenceNumber))).next((()=>this.nr.ir(e,(s=>n.Xn(s))))).next((()=>n.maxValue))}removeTargets(e,t,n){return this.nr.removeTargets(e,t,n)}removeOrphanedDocuments(e,t){return this.nr.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(U("LruGarbageCollector","Garbage collection skipped; disabled"),L.resolve(Hf)):this.getCacheSize(e).next((n=>n<this.params.cacheSizeCollectionThreshold?(U("LruGarbageCollector",`Garbage collection skipped; Cache size ${n} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Hf):this.sr(e,t)))}getCacheSize(e){return this.nr.getCacheSize(e)}sr(e,t){let n,s,i,a,B,u,l,f=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next((C=>(C>this.params.maximumSequenceNumbersToCollect?(U("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${C}`),s=this.params.maximumSequenceNumbersToCollect):s=C,a=Date.now(),this.nthSequenceNumber(e,s)))).next((C=>(n=C,B=Date.now(),this.removeTargets(e,n,t)))).next((C=>(i=C,u=Date.now(),this.removeOrphanedDocuments(e,n)))).next((C=>(l=Date.now(),Kn()<=se.DEBUG&&U("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${a-f}ms
	Determined least recently used ${s} in `+(B-a)+`ms
	Removed ${i} targets in `+(u-B)+`ms
	Removed ${C} documents in `+(l-u)+`ms
Total Duration: ${l-f}ms`),L.resolve({didRun:!0,sequenceNumbersCollected:s,targetsRemoved:i,documentsRemoved:C}))))}};function Wm(r,e){return new vB(r,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Kd="firestore.googleapis.com",jf=!0,Zi=class{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new j(M.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=Kd,this.ssl=jf}else this.host=e.host,this.ssl=e.ssl??jf;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e._customHeaders&&(this._customHeaders={...e._customHeaders}),e.cacheSizeBytes===void 0)this.cacheSizeBytes=Jd;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<$m)throw new j(M.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}if(Bd("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=jd(e.experimentalLongPollingOptions??{}),(function(n){if(n.timeoutSeconds!==void 0){if(isNaN(n.timeoutSeconds))throw new j(M.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (must not be NaN)`);if(n.timeoutSeconds<5)throw new j(M.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (minimum allowed value is 5)`);if(n.timeoutSeconds>30)throw new j(M.INVALID_ARGUMENT,`invalid long polling timeout: ${n.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams,e.grpcFlowControlWindow!==void 0){if(typeof e.grpcFlowControlWindow!="number"||e.grpcFlowControlWindow<=0||e.grpcFlowControlWindow>2147483647||!Number.isInteger(e.grpcFlowControlWindow))throw new j(M.INVALID_ARGUMENT,"grpcFlowControlWindow must be a positive integer and cannot exceed 2147483647");this.grpcFlowControlWindow=e.grpcFlowControlWindow}}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(n,s){return n.timeoutSeconds===s.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams&&this.grpcFlowControlWindow===e.grpcFlowControlWindow&&(function(n,s){if(n===s)return!0;if(!n||!s)return!1;let i=Object.keys(n),a=Object.keys(s);if(i.length!==a.length)return!1;for(let B of i)if(n[B]!==s[B])return!1;return!0})(this._customHeaders,e._customHeaders)}},bo=class{constructor(e,t,n,s){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=n,this._app=s,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Zi({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new j(M.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new j(M.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Zi(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=(function(n){if(!n)return new Ki;switch(n.type){case"firstParty":return new pB(n.sessionIndex||"0",n.iamToken||null,n.authTokenFactory||null);case"provider":return n.client;default:throw new j(M.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){let n=Gf.get(t);n&&(U(Jm,"Removing Datastore"),Gf.delete(t),n.terminate())})(this),Promise.resolve()}};function vo(r,e,t,n={}){r=Hs(r,bo);let s=ua(e),i=r._getSettings(),a={...i,emulatorOptions:r._getEmulatorOptions()},B=`${e}:${t}`;s&&hh(`https://${B}`),i.host!==Kd&&i.host!==B&&ut("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");let u={...i,host:B,ssl:s,emulatorOptions:n};if(!Cn(u,a)&&(r._setSettings(u),n.mockUserToken)){let l,f;if(typeof n.mockUserToken=="string")l=n.mockUserToken,f=xe.MOCK_USER;else{l=Bh(n.mockUserToken,r._app?.options.projectId);let C=n.mockUserToken.sub||n.mockUserToken.user_id;if(!C)throw new j(M.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");f=new xe(C)}r._authCredentials=new dB(new Ji(l,f))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ws=class r{constructor(e,t,n){this.converter=t,this._query=n,this.type="query",this.firestore=e}withConverter(e){return new r(this.firestore,e,this._query)}},Oe=class r{constructor(e,t,n){this.converter=t,this._key=n,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new Nt(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new r(this.firestore,e,this._key)}toJSON(){return{type:r._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,n){if(Us(t,r._jsonSchema))return new r(e,n||null,new Q(le.fromString(t.referencePath)))}};Oe._jsonSchemaVersion="firestore/documentReference/1.0",Oe._jsonSchema={type:Ie("string",Oe._jsonSchemaVersion),referencePath:Ie("string")};var Nt=class r extends ws{constructor(e,t,n){super(e,t,Io(n)),this._path=n,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){let e=this._path.popLast();return e.isEmpty()?null:new Oe(this.firestore,null,new Q(e))}withConverter(e){return new r(this.firestore,e,this._path)}};function So(r,e,...t){if(r=Kt(r),ad("collection","path",e),r instanceof bo){let n=le.fromString(e,...t);return Df(n),new Nt(r,null,n)}{if(!(r instanceof Oe||r instanceof Nt))throw new j(M.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");let n=r._path.child(le.fromString(e,...t));return Df(n),new Nt(r.firestore,null,n)}}function Ro(r,e,...t){if(r=Kt(r),arguments.length===1&&(e=rr.newId()),ad("doc","path",e),r instanceof bo){let n=le.fromString(e,...t);return _f(n),new Oe(r,null,new Q(n))}{if(!(r instanceof Oe||r instanceof Nt))throw new j(M.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");let n=r._path.child(le.fromString(e,...t));return _f(n),new Oe(r.firestore,r instanceof Nt?r.converter:null,new Q(n))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var st=class r{constructor(e){this._values=(e||[]).map((t=>t))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(n,s){if(n.length!==s.length)return!1;for(let i=0;i<n.length;++i)if(n[i]!==s[i])return!1;return!0})(this._values,e._values)}toJSON(){return{type:r._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(Us(e,r._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every((t=>typeof t=="number")))return new r(e.vectorValues);throw new j(M.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}};st._jsonSchemaVersion="firestore/vectorValue/1.0",st._jsonSchema={type:Ie("string",st._jsonSchemaVersion),vectorValues:Ie("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ym(r){switch(r){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw Y(40011,{dataSource:r})}}function Is(r,e,t){if(zd(r=Kt(r)))return Zm("Unsupported field value:",e,r),Xm(r,e);if(r instanceof ys)return(function(s,i){if(!Ym(i.dataSource))throw i.createError(`${s._methodName}() can only be used with update() and set()`);if(!i.path)throw i.createError(`${s._methodName}() is not currently supported inside arrays`);let a=s._toFieldTransform(i);a&&i.fieldTransforms.push(a)})(r,e),null;if(r===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),r instanceof Array){if(e.settings.arrayElement&&e.dataSource!==4)throw e.createError("Nested arrays are not supported");return(function(s,i){let a=[],B=0;for(let u of s){let l=Is(u,i.childContextForArray(B));l==null&&(l={nullValue:"NULL_VALUE"}),a.push(l),B++}return{arrayValue:{values:a}}})(r,e)}return(function(s,i,a){if((s=Kt(s))===null)return{nullValue:"NULL_VALUE"};if(typeof s=="number")return xc(i.serializer,s);if(typeof s=="boolean")return{booleanValue:s};if(typeof s=="string")return{stringValue:s};if(s instanceof Date){let B=Te.fromDate(s);return{timestampValue:ji(i.serializer,B)}}if(s instanceof Te){let B=new Te(s.seconds,1e3*Math.floor(s.nanoseconds/1e3));return{timestampValue:ji(i.serializer,B)}}if(s instanceof Rt)return{geoPointValue:{latitude:s.latitude,longitude:s.longitude}};if(s instanceof St)return{bytesValue:xd(i.serializer,s._byteString)};if(s instanceof Oe){let B=i.databaseId,u=s.firestore._databaseId;if(!u.isEqual(B))throw i.createError(`Document reference is for database ${u.projectId}/${u.database} but should be for database ${B.projectId}/${B.database}`);return{referenceValue:Lc(s.firestore._databaseId||i.databaseId,s._key.path)}}if(s instanceof st)return(function(u,l){let f=u instanceof st?u.toArray():u;return{mapValue:{fields:{[Rc]:{stringValue:Nc},[Sn]:{arrayValue:{values:f.map((D=>{if(typeof D!="number")throw l.createError("VectorValues must only contain numeric values.");return wo(l.serializer,D)}))}}}}}})(s,i);if(Gd(s))return s._toProto(i.serializer);throw i.createError(`Unsupported field value: ${Do(s)}`)})(r,e)}function Xm(r,e){let t={};return od(r)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):vr(r,((n,s)=>{let i=Is(s,e.childContextForField(n));i!=null&&(t[n]=i)})),{mapValue:{fields:t}}}function zd(r){return!(typeof r!="object"||r===null||r instanceof Array||r instanceof Date||r instanceof Te||r instanceof Rt||r instanceof St||r instanceof Oe||r instanceof ys||r instanceof st||Gd(r))}function Zm(r,e,t){if(!zd(t)||!Gs(t)){let n=Do(t);throw n==="an object"?e.createError(r+" a custom object"):e.createError(r+" "+n)}}function No(r,e,t){if((e=Kt(e))instanceof gr)return e._internalPath;if(typeof e=="string")return Qd(r,e);throw SB("Field path arguments must be of type string or ",r,!1,void 0,t)}var eE=new RegExp("[~\\*/\\[\\]]");function Qd(r,e,t){if(e.search(eE)>=0)throw SB(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,r,!1,void 0,t);try{return new gr(...e.split("."))._internalPath}catch{throw SB(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,r,!1,void 0,t)}}function SB(r,e,t,n,s){let i=n&&!n.isEmpty(),a=s!==void 0,B=`Function ${e}() called with invalid data`;t&&(B+=" (via `toFirestore()`)"),B+=". ";let u="";return(i||a)&&(u+=" (found",i&&(u+=` in field ${n}`),a&&(u+=` in document ${s}`),u+=")"),new j(M.INVALID_ARGUMENT,B+r+u)}function tE(r){return typeof r._readUserData=="function"}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var He=class r{constructor(e){this.optionDefinitions=e}_getKnownOptions(e,t){let n=ht.empty();for(let s in this.optionDefinitions)if(this.optionDefinitions.hasOwnProperty(s)){let i=this.optionDefinitions[s];if(s in e){let a=e[s],B;i.nestedOptions&&Gs(a)?B={mapValue:{fields:new r(i.nestedOptions).getOptionsProto(t,a)}}:a&&(B=Is(a,t)??void 0),B&&n.set(Bt.fromServerFormat(i.serverName),B)}}return n}getOptionsProto(e,t,n){let s=this._getKnownOptions(t,e);if(n){let i=new Map(id(n,((a,B)=>[Bt.fromServerFormat(B),a!==void 0?Is(a,e):null])));s.setAll(i)}return s.value.mapValue.fields??{}}};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nE(r){return typeof r=="object"&&r!==null&&!!("nullValue"in r&&(r.nullValue===null||r.nullValue==="NULL_VALUE")||"booleanValue"in r&&(r.booleanValue===null||typeof r.booleanValue=="boolean")||"integerValue"in r&&(r.integerValue===null||typeof r.integerValue=="number"||typeof r.integerValue=="string")||"doubleValue"in r&&(r.doubleValue===null||typeof r.doubleValue=="number")||"timestampValue"in r&&(r.timestampValue===null||(function(t){return typeof t=="object"&&t!==null&&"seconds"in t&&(t.seconds===null||typeof t.seconds=="number"||typeof t.seconds=="string")&&"nanos"in t&&(t.nanos===null||typeof t.nanos=="number")})(r.timestampValue))||"stringValue"in r&&(r.stringValue===null||typeof r.stringValue=="string")||"bytesValue"in r&&(r.bytesValue===null||r.bytesValue instanceof Uint8Array)||"referenceValue"in r&&(r.referenceValue===null||typeof r.referenceValue=="string")||"geoPointValue"in r&&(r.geoPointValue===null||(function(t){return typeof t=="object"&&t!==null&&"latitude"in t&&(t.latitude===null||typeof t.latitude=="number")&&"longitude"in t&&(t.longitude===null||typeof t.longitude=="number")})(r.geoPointValue))||"arrayValue"in r&&(r.arrayValue===null||(function(t){return typeof t=="object"&&t!==null&&!(!("values"in t)||t.values!==null&&!Array.isArray(t.values))})(r.arrayValue))||"mapValue"in r&&(r.mapValue===null||(function(t){return typeof t=="object"&&t!==null&&!(!("fields"in t)||t.fields!==null&&!Gs(t.fields))})(r.mapValue))||"fieldReferenceValue"in r&&(r.fieldReferenceValue===null||typeof r.fieldReferenceValue=="string")||"functionValue"in r&&(r.functionValue===null||(function(t){return typeof t=="object"&&t!==null&&!(!("name"in t)||t.name!==null&&typeof t.name!="string"||!("args"in t)||t.args!==null&&!Array.isArray(t.args))})(r.functionValue))||"pipelineValue"in r&&(r.pipelineValue===null||(function(t){return typeof t=="object"&&t!==null&&!(!("stages"in t)||t.stages!==null&&!Array.isArray(t.stages))})(r.pipelineValue)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $d(r){return new st(r)}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function k(r){let e;return r instanceof Vt?r:(e=Gs(r)?iE(r):r instanceof Array?oE(r):Wd(r,void 0),e)}function Ja(r){if(r instanceof Vt)return r;if(r instanceof st)return Ts(r);if(Array.isArray(r))return Ts($d(r));throw new Error("Unsupported value: "+typeof r)}function Vc(r){return sm(r)?rE(r):k(r)}var Vt=class{constructor(){this._protoValueType="ProtoValue"}add(e){return new P("add",[this,k(e)],"add")}asBoolean(){if(this instanceof rn)return this;if(this instanceof Er)return new to(this);if(this instanceof xn)return new FB(this);if(this instanceof P)return new eo(this);throw new j("invalid-argument",`Conversion of type ${typeof this} to BooleanExpression not supported.`)}subtract(e){return new P("subtract",[this,k(e)],"subtract")}multiply(e){return new P("multiply",[this,k(e)],"multiply")}divide(e){return new P("divide",[this,k(e)],"divide")}mod(e){return new P("mod",[this,k(e)],"mod")}equal(e){return new P("equal",[this,k(e)],"equal").asBoolean()}notEqual(e){return new P("not_equal",[this,k(e)],"notEqual").asBoolean()}lessThan(e){return new P("less_than",[this,k(e)],"lessThan").asBoolean()}lessThanOrEqual(e){return new P("less_than_or_equal",[this,k(e)],"lessThanOrEqual").asBoolean()}greaterThan(e){return new P("greater_than",[this,k(e)],"greaterThan").asBoolean()}greaterThanOrEqual(e){return new P("greater_than_or_equal",[this,k(e)],"greaterThanOrEqual").asBoolean()}arrayConcat(e,...t){let n=[e,...t].map((s=>k(s)));return new P("array_concat",[this,...n],"arrayConcat")}arrayContains(e){return new P("array_contains",[this,k(e)],"arrayContains").asBoolean()}arrayContainsAll(e){let t=Array.isArray(e)?new Tn(e.map(k),"arrayContainsAll"):e;return new P("array_contains_all",[this,t],"arrayContainsAll").asBoolean()}arrayContainsAny(e){let t=Array.isArray(e)?new Tn(e.map(k),"arrayContainsAny"):e;return new P("array_contains_any",[this,t],"arrayContainsAny").asBoolean()}arrayReverse(){return new P("array_reverse",[this])}arrayLength(){return new P("array_length",[this],"arrayLength")}equalAny(e){let t=Array.isArray(e)?new Tn(e.map(k),"equalAny"):e;return new P("equal_any",[this,t],"equalAny").asBoolean()}notEqualAny(e){let t=Array.isArray(e)?new Tn(e.map(k),"notEqualAny"):e;return new P("not_equal_any",[this,t],"notEqualAny").asBoolean()}exists(){return new P("exists",[this],"exists").asBoolean()}charLength(){return new P("char_length",[this],"charLength")}like(e){return new P("like",[this,k(e)],"like").asBoolean()}regexContains(e){return new P("regex_contains",[this,k(e)],"regexContains").asBoolean()}regexFind(e){return new P("regex_find",[this,k(e)],"regexFind")}regexFindAll(e){return new P("regex_find_all",[this,k(e)],"regexFindAll")}regexMatch(e){return new P("regex_match",[this,k(e)],"regexMatch").asBoolean()}stringContains(e){return new P("string_contains",[this,k(e)],"stringContains").asBoolean()}startsWith(e){return new P("starts_with",[this,k(e)],"startsWith").asBoolean()}endsWith(e){return new P("ends_with",[this,k(e)],"endsWith").asBoolean()}toLower(){return new P("to_lower",[this],"toLower")}toUpper(){return new P("to_upper",[this],"toUpper")}trim(e){let t=[this];return e&&t.push(k(e)),new P("trim",t,"trim")}ltrim(e){let t=[this];return e&&t.push(k(e)),new P("ltrim",t,"ltrim")}rtrim(e){let t=[this];return e&&t.push(k(e)),new P("rtrim",t,"rtrim")}type(){return new P("type",[this])}isType(e){return new P("is_type",[this,Ts(e)],"isType").asBoolean()}stringConcat(e,...t){let n=[e,...t].map(k);return new P("string_concat",[this,...n],"stringConcat")}stringIndexOf(e){return new P("string_index_of",[this,k(e)],"stringIndexOf")}stringRepeat(e){return new P("string_repeat",[this,k(e)],"stringRepeat")}stringReplaceAll(e,t){return new P("string_replace_all",[this,k(e),k(t)],"stringReplaceAll")}stringReplaceOne(e,t){return new P("string_replace_one",[this,k(e),k(t)],"stringReplaceOne")}concat(e,...t){let n=[e,...t].map(k);return new P("concat",[this,...n],"concat")}reverse(){return new P("reverse",[this],"reverse")}arrayFilter(e,t){return new P("array_filter",[this,k(e),t],"arrayFilter")}arrayTransform(e,t){return new P("array_transform",[this,k(e),t],"arrayTransform")}arrayTransformWithIndex(e,t,n){return new P("array_transform",[this,k(e),k(t),n],"arrayTransformWithIndex")}arraySlice(e,t){let n=[this,k(e)];return t!==void 0&&n.push(k(t)),new P("array_slice",n,"arraySlice")}arrayFirst(){return new P("array_first",[this],"arrayFirst")}arrayFirstN(e){return new P("array_first_n",[this,k(e)],"arrayFirstN")}arrayLast(){return new P("array_last",[this],"arrayLast")}arrayLastN(e){return new P("array_last_n",[this,k(e)],"arrayLastN")}arrayMaximum(){return new P("maximum",[this],"arrayMaximum")}arrayMaximumN(e){return new P("maximum_n",[this,k(e)],"arrayMaximumN")}arrayMinimum(){return new P("minimum",[this],"arrayMinimum")}arrayMinimumN(e){return new P("minimum_n",[this,k(e)],"arrayMinimumN")}arrayIndexOf(e){return new P("array_index_of",[this,k(e),k("first")],"arrayIndexOf")}arrayLastIndexOf(e){return new P("array_index_of",[this,k(e),k("last")],"arrayLastIndexOf")}arrayIndexOfAll(e){return new P("array_index_of_all",[this,k(e)],"arrayIndexOfAll")}byteLength(){return new P("byte_length",[this],"byteLength")}ceil(){return new P("ceil",[this])}floor(){return new P("floor",[this])}abs(){return new P("abs",[this])}exp(){return new P("exp",[this])}mapGet(e){return new P("map_get",[this,Ts(e)],"mapGet")}mapSet(e,t,...n){let s=[this,k(e),k(t),...n.map(k)];return new P("map_set",s,"mapSet")}mapKeys(){return new P("map_keys",[this],"mapKeys")}mapValues(){return new P("map_values",[this],"mapValues")}mapEntries(){return new P("map_entries",[this],"mapEntries")}getField(e){return new P("get_field",[this,k(e)],"get_field")}count(){return tt._create("count",[this],"count")}sum(){return tt._create("sum",[this],"sum")}average(){return tt._create("average",[this],"average")}minimum(){return tt._create("minimum",[this],"minimum")}maximum(){return tt._create("maximum",[this],"maximum")}first(){return tt._create("first",[this],"first")}last(){return tt._create("last",[this],"last")}arrayAgg(){return tt._create("array_agg",[this],"arrayAgg")}arrayAggDistinct(){return tt._create("array_agg_distinct",[this],"arrayAggDistinct")}countDistinct(){return tt._create("count_distinct",[this],"countDistinct")}logicalMaximum(e,...t){let n=[e,...t];return new P("maximum",[this,...n.map(k)],"logicalMaximum")}logicalMinimum(e,...t){let n=[e,...t];return new P("minimum",[this,...n.map(k)],"minimum")}vectorLength(){return new P("vector_length",[this],"vectorLength")}cosineDistance(e){return new P("cosine_distance",[this,Ja(e)],"cosineDistance")}dotProduct(e){return new P("dot_product",[this,Ja(e)],"dotProduct")}euclideanDistance(e){return new P("euclidean_distance",[this,Ja(e)],"euclideanDistance")}unixMicrosToTimestamp(){return new P("unix_micros_to_timestamp",[this],"unixMicrosToTimestamp")}timestampToUnixMicros(){return new P("timestamp_to_unix_micros",[this],"timestampToUnixMicros")}unixMillisToTimestamp(){return new P("unix_millis_to_timestamp",[this],"unixMillisToTimestamp")}timestampToUnixMillis(){return new P("timestamp_to_unix_millis",[this],"timestampToUnixMillis")}unixSecondsToTimestamp(){return new P("unix_seconds_to_timestamp",[this],"unixSecondsToTimestamp")}timestampToUnixSeconds(){return new P("timestamp_to_unix_seconds",[this],"timestampToUnixSeconds")}timestampAdd(e,t){return new P("timestamp_add",[this,k(e),k(t)],"timestampAdd")}timestampSubtract(e,t){return new P("timestamp_subtract",[this,k(e),k(t)],"timestampSubtract")}timestampDiff(e,t){return new P("timestamp_diff",[this,Vc(e),k(t)],"timestampDiff")}timestampExtract(e,t){let n=[this,k(e)];return t&&n.push(k(t)),new P("timestamp_extract",n,"timestampExtract")}documentId(){return new P("document_id",[this],"documentId")}parent(){return new P("parent",[this],"parent")}substring(e,t){let n=k(e);return new P("substring",t===void 0?[this,n]:[this,n,k(t)],"substring")}arrayGet(e){return new P("array_get",[this,k(e)],"arrayGet")}isError(){return new P("is_error",[this],"isError").asBoolean()}ifError(e){let t=new P("if_error",[this,k(e)],"ifError");return e instanceof rn?t.asBoolean():t}isAbsent(){return new P("is_absent",[this],"isAbsent").asBoolean()}mapRemove(e){return new P("map_remove",[this,k(e)],"mapRemove")}mapMerge(e,...t){let n=k(e),s=t.map(k);return new P("map_merge",[this,n,...s],"mapMerge")}pow(e){return new P("pow",[this,k(e)])}trunc(e){return e===void 0?new P("trunc",[this]):new P("trunc",[this,k(e)],"trunc")}round(e){return e===void 0?new P("round",[this]):new P("round",[this,k(e)],"round")}collectionId(){return new P("collection_id",[this])}length(){return new P("length",[this])}ln(){return new P("ln",[this])}sqrt(){return new P("sqrt",[this])}stringReverse(){return new P("string_reverse",[this])}ifAbsent(e){return new P("if_absent",[this,k(e)],"ifAbsent")}ifNull(e){return new P("if_null",[this,k(e)],"ifNull")}coalesce(e,...t){return new P("coalesce",[this,k(e),...t.map(k)],"coalesce")}join(e){return new P("join",[this,k(e)],"join")}log10(){return new P("log10",[this])}arraySum(){return new P("sum",[this])}split(e){return new P("split",[this,k(e)])}timestampTruncate(e,t){let n=[this,k(e)];return t&&n.push(k(t)),new P("timestamp_trunc",n)}ascending(){return aE(this)}descending(){return BE(this)}as(e){return new NB(this,e,"as")}},tt=class r{constructor(e,t){this.name=e,this.params=t,this.exprType="AggregateFunction",this._protoValueType="ProtoValue"}static _create(e,t,n){let s=new r(e,t);return s._methodName=n,s}as(e){return new RB(this,e,"as")}_toProto(e){return{functionValue:{name:this.name,args:this.params.map((t=>t._toProto(e)))}}}_readUserData(e){e=this._methodName?e.contextWith({methodName:this._methodName}):e,this.params.forEach((t=>t._readUserData(e)))}},RB=class{constructor(e,t,n){this.aggregate=e,this.alias=t,this._methodName=n}_readUserData(e){this.aggregate._readUserData(e)}},NB=class{constructor(e,t,n){this.expr=e,this.alias=t,this._methodName=n,this.exprType="AliasedExpression",this.selectable=!0}_readUserData(e){this.expr._readUserData(e)}},Tn=class extends Vt{constructor(e,t){super(),this.ur=e,this._methodName=t,this.expressionType="ListOfExpressions"}_toProto(e){return{arrayValue:{values:this.ur.map((t=>t._toProto(e)))}}}_readUserData(e){this.ur.forEach((t=>t._readUserData(e)))}},xn=class extends Vt{constructor(e,t){super(),this.fieldPath=e,this._methodName=t,this.expressionType="Field",this.selectable=!0}get _fieldPath(){return this.fieldPath}get fieldName(){return this.fieldPath.canonicalString()}get alias(){return this.fieldName}get expr(){return this}geoDistance(e){return new P("geo_distance",[this,k(e)],"geoDistance")}_toProto(e){return{fieldReferenceValue:this.fieldPath.canonicalString()}}_readUserData(e){}};function rE(r){return sE(r,"field")}function sE(r,e){return new xn(typeof r=="string"?ir===r?qd()._internalPath:No("field",r):r._internalPath,e)}var Er=class r extends Vt{constructor(e,t){super(),this.value=e,this._methodName=t,this.expressionType="Constant"}static _fromProto(e){let t=new r(e,void 0);return t._protoValue=e,t}_toProto(e){return $(this._protoValue!==void 0,237),this._protoValue}_getValue(){return this._protoValue}_readUserData(e){e=this._methodName?e.contextWith({methodName:this._methodName}):e,nE(this._protoValue)||(this._protoValue=Is(this.value,e))}};function Ts(r,e){return Wd(r,"constant")}function Wd(r,e){let t=new Er(r,e);return typeof r=="boolean"?new to(t):t}var P=class extends Vt{constructor(e,t,n,s){super(),this.name=e,this.params=t,this.expressionType="Function",this._optionsProto=void 0,n!==void 0&&(this._methodName=n),s!==void 0&&(this._options=s)}get _optionsUtil(){return new He({})}_toProto(e){let t={functionValue:{name:this.name,args:this.params.map((n=>n._toProto(e)))}};return this._optionsProto&&(t.functionValue.options=this._optionsProto),t}_readUserData(e){e=this._methodName?e.contextWith({methodName:this._methodName}):e,this.params.forEach((t=>t._readUserData(e))),this._options&&(this._optionsProto=this._optionsUtil.getOptionsProto(e,this._options))}},rn=class r extends Vt{get _methodName(){return this._expr._methodName}countIf(){return tt._create("count_if",[this],"countIf")}not(){return new P("not",[this],"not").asBoolean()}conditional(e,t){return new P("conditional",[this,e,t],"conditional")}ifError(e){let t=k(e),n=new P("if_error",[this,t],"ifError");return t instanceof r?n.asBoolean():n}_toProto(e){return this._expr._toProto(e)}_readUserData(e){this._expr._readUserData(e)}},eo=class extends rn{constructor(e){super(),this._expr=e,this.expressionType="Function"}},to=class extends rn{constructor(e){super(),this._expr=e,this.expressionType="Constant"}_getValue(){return this._expr._getValue()}},FB=class extends rn{constructor(e){super(),this._expr=e,this.expressionType="Field"}};function iE(r,e){let t=[];for(let n in r)if(Object.prototype.hasOwnProperty.call(r,n)){let s=r[n];t.push(Ts(n)),t.push(k(s))}return new P("map",t,"map")}function oE(r){return(function(t,n){return new P("array",t.map((s=>k(s))),n)})(r,"array")}function aE(r){return new no(Vc(r),"ascending","ascending")}function BE(r){return new no(Vc(r),"descending","descending")}var no=class{constructor(e,t,n){this.expr=e,this.direction=t,this._methodName=n,this._protoValueType="ProtoValue"}_toProto(e){return{mapValue:{fields:{direction:Hd(this.direction),expression:this.expr._toProto(e)}}}}_readUserData(e){this.expr._readUserData(e)}};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Je=class{constructor(e){this.optionsProto=void 0,{rawOptions:this.rawOptions,...this.knownOptions}=e}_readUserData(e){this.optionsProto=this._optionsUtil.getOptionsProto(e,this.knownOptions,this.rawOptions)}_toProto(e){return{name:this._name,options:this.optionsProto}}},ro=class extends Je{get _name(){return"add_fields"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.fields=e}_toProto(e){return{...super._toProto(e),args:[Ds(e,this.fields)]}}_readUserData(e){super._readUserData(e),sn(this.fields,e)}};var so=class extends Je{get _name(){return"aggregate"}get _optionsUtil(){return new He({})}constructor(e,t,n){super(n),this.groups=e,this.accumulators=t}_toProto(e){return{...super._toProto(e),args:[Ds(e,this.accumulators),Ds(e,this.groups)]}}_readUserData(e){super._readUserData(e),sn(this.groups,e),sn(this.accumulators,e)}},io=class extends Je{get _name(){return"distinct"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.groups=e}_toProto(e){return{...super._toProto(e),args:[Ds(e,this.groups)]}}_readUserData(e){super._readUserData(e),sn(this.groups,e)}},_r=class extends Je{get _name(){return"collection"}get _optionsUtil(){return new He({forceIndex:{serverName:"force_index"}})}constructor(e,t){super(t),this.Er=e.startsWith("/")?e:"/"+e}_toProto(e){return{...super._toProto(e),args:[{referenceValue:this.Er}]}}_readUserData(e){super._readUserData(e)}},Dr=class extends Je{get _name(){return"collection_group"}get _optionsUtil(){return new He({forceIndex:{serverName:"force_index"}})}constructor(e,t){super(t),this.collectionId=e}_toProto(e){return{...super._toProto(e),args:[{referenceValue:""},{stringValue:this.collectionId}]}}_readUserData(e){super._readUserData(e)}};var As=class extends Je{get _name(){return"database"}get _optionsUtil(){return new He({})}_toProto(e){return{...super._toProto(e)}}_readUserData(e){super._readUserData(e)}},bs=class extends Je{get _name(){return"documents"}get _optionsUtil(){return new He({})}constructor(e,t){if(super(t),!e||e.length===0)throw new j(M.INVALID_ARGUMENT,"Empty document paths are not allowed in DocumentsSource");let n=e.map((i=>i.startsWith("/")?i:"/"+i)),s=new Set(n);if(s.size!==n.length)throw new j(M.INVALID_ARGUMENT,"Duplicate document paths are not allowed in DocumentsSource");this.hr=n,this.Tr=s}_toProto(e){return{...super._toProto(e),args:this.hr.map((t=>({referenceValue:t})))}}_readUserData(e){super._readUserData(e)}},vs=class extends Je{get _name(){return"where"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.condition=e}_toProto(e){return{...super._toProto(e),args:[this.condition._toProto(e)]}}_readUserData(e){super._readUserData(e),sn(this.condition,e)}};var Pn=class extends Je{get _name(){return"limit"}get _optionsUtil(){return new He({})}constructor(e,t){$(!isNaN(e)&&e!==1/0&&e!==-1/0,34860),super(t),this.limit=e}_toProto(e){return{...super._toProto(e),args:[xc(e,this.limit)]}}},oo=class extends Je{get _name(){return"offset"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.offset=e}_toProto(e){return{...super._toProto(e),args:[xc(e,this.offset)]}}},xB=class extends Je{get _name(){return"select"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.selections=e}_toProto(e){return{...super._toProto(e),args:[Ds(e,this.selections)]}}_readUserData(e){super._readUserData(e),sn(this.selections,e)}},Ss=class extends Je{get _name(){return"sort"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.orderings=e}_toProto(e){return{...super._toProto(e),args:this.orderings.map((t=>t._toProto(e)))}}_readUserData(e){super._readUserData(e),sn(this.orderings,e)}};var PB=class r extends Je{get _name(){return"replace_with"}get _optionsUtil(){return new He({})}constructor(e,t){super(t),this.map=e}_toProto(e){return{...super._toProto(e),args:[this.map._toProto(e),Hd(r.Pr)]}}_readUserData(e){super._readUserData(e),sn(this.map,e)}};PB.Pr="full_replace";function sn(r,e){return tE(r)?r._readUserData(e):Array.isArray(r)?r.forEach((t=>t._readUserData(e))):r instanceof Map?r.forEach((t=>t._readUserData(e))):Object.values(r).forEach((t=>t._readUserData(e))),r}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */// Copyright 2024 Google LLC* @license
var Ge=class{constructor(e,t,n){this.serializer=e,this.stages=t,this.listenOptions=n,this.isCorePipeline=!0}getPipelineCollection(){return Fo(this)}getPipelineCollectionGroup(){return kc(this)}getPipelineCollectionId(){return uE(this)}getPipelineDocuments(){return OB(this)}getPipelineFlavor(){return(function(t){let n="exact";return t.stages.forEach(((s,i)=>{s._name!==io.name&&s._name!==so.name||(n="keyless"),s._name===xB.name&&n==="exact"&&(n="augmented"),s._name===ro.name&&i<t.stages.length-1&&n==="exact"&&(n="augmented")})),n})(this)}getPipelineSourceType(){return Zt(this)}};function Zt(r){let e=r.stages[0];return e instanceof _r||e instanceof Dr||e instanceof As||e instanceof bs?e._name:"unknown"}function Fo(r){if(Zt(r)==="collection")return r.stages[0].Er}function kc(r){if(Zt(r)==="collection_group")return r.stages[0].collectionId}function uE(r){switch(Zt(r)){case"collection":return le.fromString(Fo(r)).lastSegment();case"collection_group":return kc(r);default:return}}function OB(r){if(Zt(r)==="documents")return r.stages[0].hr}var T=class r{constructor(e,t){this.type=e,this.value=t}static dr(){return new r("ERROR",void 0)}static mr(){return new r("UNSET",void 0)}static pr(){return new r("NULL",Br)}static newValue(e){return nt(e)?new r("NULL",Br):(function(n){return!!n&&"booleanValue"in n})(e)?new r("BOOLEAN",e):mt(e)?new r("INT",e):wn(e)?new r("DOUBLE",e):(function(n){return!!n&&"timestampValue"in n&&!!n.timestampValue})(e)?new r("TIMESTAMP",e):(function(n){return!!n&&"stringValue"in n})(e)?new r("STRING",e):(function(n){return!!n&&"bytesValue"in n})(e)?new r("BYTES",e):e.referenceValue?new r("REFERENCE",e):e.geoPointValue?new r("GEO_POINT",e):cr(e)?new r("ARRAY",e):ls(e)?new r("VECTOR",e):Xn(e)?new r("MAP",e):new r("ERROR",void 0)}gr(){return this.type==="ERROR"||this.type==="UNSET"}yr(){return this.type==="NULL"}};function Bs(r){if(!r.gr())return r.value}function Yd(r){return r instanceof rn?r._expr:r}function X(r){if((r=Yd(r))instanceof xn)return new LB(r);if(r instanceof Er)return new VB(r);if(r instanceof Tn)return new kB(r);if(r instanceof P){if(r.name==="add")return new MB(r);if(r.name==="subtract")return new GB(r);if(r.name==="multiply")return new HB(r);if(r.name==="divide")return new UB(r);if(r.name==="mod")return new qB(r);if(r.name==="and")return new jB(r);if(r.name==="equal")return new ru(r);if(r.name==="not_equal")return new su(r);if(r.name==="less_than")return new iu(r);if(r.name==="less_than_or_equal")return new ou(r);if(r.name==="greater_than")return new au(r);if(r.name==="greater_than_or_equal")return new Bu(r);if(r.name==="array_concat")return new uu(r);if(r.name==="array_reverse")return new cu(r);if(r.name==="array_contains")return new lu(r);if(r.name==="array_contains_all")return new hu(r);if(r.name==="array_contains_any")return new fu(r);if(r.name==="array_length")return new du(r);if(r.name==="array_element")return new Cu(r);if(r.name==="equal_any")return new ao(r);if(r.name==="not_equal_any")return new zB(r);if(r.name==="is_nan")return new QB(r);if(r.name==="is_not_nan")return new $B(r);if(r.name==="is_null")return new WB(r);if(r.name==="is_not_null")return new YB(r);if(r.name==="is_error")return new XB(r);if(r.name==="exists")return new ZB(r);if(r.name==="not")return new yr(r);if(r.name==="or")return new JB(r);if(r.name==="xor")return new KB(r);if(r.name==="conditional")return new eu(r);if(r.name==="maximum")return new tu(r);if(r.name==="minimum")return new nu(r);if(r.name==="reverse")return new pu(r);if(r.name==="replace_first")return new gu(r);if(r.name==="replace_all")return new mu(r);if(r.name==="char_length")return new Eu(r);if(r.name==="byte_length")return new _u(r);if(r.name==="like")return new Du(r);if(r.name==="regex_contains")return new yu(r);if(r.name==="regex_match")return new wu(r);if(r.name==="string_contains")return new Iu(r);if(r.name==="starts_with")return new Tu(r);if(r.name==="ends_with")return new Au(r);if(r.name==="to_lower")return new bu(r);if(r.name==="to_upper")return new vu(r);if(r.name==="trim")return new Su(r);if(r.name==="string_concat")return new Ru(r);if(r.name==="map_get")return new Nu(r);if(r.name==="cosine_distance")return new Fu(r);if(r.name==="dot_product")return new xu(r);if(r.name==="euclidean_distance")return new Pu(r);if(r.name==="vector_length")return new Ou(r);if(r.name==="unix_micros_to_timestamp")return new Lu(r);if(r.name==="timestamp_to_unix_micros")return new Mu(r);if(r.name==="unix_millis_to_timestamp")return new Vu(r);if(r.name==="timestamp_to_unix_millis")return new Gu(r);if(r.name==="unix_seconds_to_timestamp")return new ku(r);if(r.name==="timestamp_to_unix_seconds")return new Hu(r);if(r.name==="timestamp_add")return new Uu(r);if(r.name==="timestamp_subtract")return new qu(r)}throw new Error(`Unknown Expr : ${r}`)}var LB=class{constructor(e){this.expr=e}evaluate(e,t){if(this.expr.fieldName===ir)return T.newValue({referenceValue:Nm(e.serializer,t.key)});if(this.expr.fieldName==="__update_time__")return T.newValue({timestampValue:Ua(e.serializer,t.version)});if(this.expr.fieldName==="__create_time__")return T.newValue({timestampValue:Ua(e.serializer,t.createTime)});let n=t.data.field(this.expr._fieldPath);return n?qs(n)?T.newValue((function(i,a){if(i.serverTimestampBehavior==="estimate")return{timestampValue:Ua(i.serializer,Z.fromTimestamp(or(a)))};if(i.serverTimestampBehavior==="previous"){let B=js(a);if(B)return B}return{nullValue:"NULL_VALUE"}})(e,n)):T.newValue(n):T.mr()}},VB=class{constructor(e){this.expr=e}evaluate(e,t){return T.newValue(this.expr._getValue())}},kB=class{constructor(e){this.expr=e}evaluate(e,t){let n=this.expr.ur.map((s=>X(s).evaluate(e,t)));return n.some((s=>s.gr()))?T.dr():T.newValue({arrayValue:{values:n.map((s=>s.value))}})}};function Le(r){return wn(r)?Number(r.doubleValue):Number(r.integerValue)}function Dt(r){return BigInt(r.integerValue)}var cE=BigInt("0x7fffffffffffffff"),lE=-BigInt("0x8000000000000000"),On=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length>=2,24778);let n=X(this.expr.params[0]).evaluate(e,t),s=X(this.expr.params[1]).evaluate(e,t),i=this.wr(n,s);for(let a of this.expr.params.slice(2)){let B=X(a).evaluate(e,t);i=this.wr(i,B)}return i}wr(e,t){if(e.gr()||t.gr())return T.dr();if(e.yr()||t.yr())return T.pr();let n=e.value,s=t.value;if(!wn(n)&&!mt(n)||!wn(s)&&!mt(s))return T.dr();if(wn(n)||wn(s)){let i=this.br(n,s);return i?T.newValue(i):T.dr()}if(mt(n)&&mt(s)){let i=this.Sr(n,s);return i===void 0?T.dr():typeof i=="number"?T.newValue({doubleValue:i}):i<lE||i>cE?T.dr():T.newValue({integerValue:`${i}`})}return T.dr()}};function kt(r,e){return be(r)!==be(e)?"TYPE_MISMATCH":Ye(r)||Ye(e)?"NOT_EQ":nt(r)&&nt(e)?"EQ":nt(r)||nt(e)?"NULL":cr(r)&&cr(e)?(function(n,s){if(n.values?.length!==s.values?.length)return"NOT_EQ";let i=!1;for(let a=0;a<(n.values?.length??0);a++){let B=n.values[a],u=s.values[a];switch(kt(B,u)){case"EQ":break;case"NOT_EQ":case"TYPE_MISMATCH":return"NOT_EQ";case"NULL":i=!0;break;default:Y(44609,{vr:B,Dr:u})}}return i?"NULL":"EQ"})(r.arrayValue,e.arrayValue):ls(r)&&ls(e)||Xn(r)&&Xn(e)?(function(n,s){let i=n.fields||{},a=s.fields||{};if(xi(i)!==xi(a))return"NOT_EQ";let B=!1;for(let u in i)if(i.hasOwnProperty(u)){if(a[u]===void 0)return"NOT_EQ";switch(kt(i[u],a[u])){case"NOT_EQ":case"TYPE_MISMATCH":return"NOT_EQ";case"NULL":B=!0}}return B?"NULL":"EQ"})(r.mapValue,e.mapValue):(function(n,s){return ct(n,s,{o:!1,t:!0,i:!0})})(r,e)?"EQ":"NOT_EQ"}var MB=class extends On{Sr(e,t){return Dt(e)+Dt(t)}br(e,t){return{doubleValue:Le(e)+Le(t)}}},GB=class extends On{constructor(e){super(e),this.expr=e}Sr(e,t){return Dt(e)-Dt(t)}br(e,t){return{doubleValue:Le(e)-Le(t)}}},HB=class extends On{constructor(e){super(e),this.expr=e}Sr(e,t){return Dt(e)*Dt(t)}br(e,t){return{doubleValue:Le(e)*Le(t)}}},UB=class extends On{constructor(e){super(e),this.expr=e}Sr(e,t){let n=Dt(t);if(n!==BigInt(0))return Dt(e)/n}br(e,t){let n=Le(t);return n===0?{doubleValue:ar(n)?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY}:{doubleValue:Le(e)/n}}},qB=class extends On{constructor(e){super(e),this.expr=e}Sr(e,t){let n=Dt(t);if(n!==BigInt(0))return Dt(e)%n}br(e,t){let n=Le(t);if(n!==0)return{doubleValue:Le(e)%n}}},jB=class{constructor(e){this.expr=e}evaluate(e,t){let n=!1,s=!1;for(let i of this.expr.params){let a=X(i).evaluate(e,t);switch(a.type){case"BOOLEAN":if(!a.value?.booleanValue)return T.newValue(Pe);break;case"NULL":s=!0;break;default:n=!0}}return n?T.dr():s?T.pr():T.newValue($e)}},yr=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,9634);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"BOOLEAN":return T.newValue({booleanValue:!n.value?.booleanValue});case"NULL":return T.pr();default:return T.dr()}}},JB=class{constructor(e){this.expr=e}evaluate(e,t){let n=!1,s=!1;for(let i of this.expr.params){let a=X(i).evaluate(e,t);switch(a.type){case"BOOLEAN":if(a.value?.booleanValue)return T.newValue($e);break;case"NULL":s=!0;break;default:n=!0}}return n?T.dr():s?T.pr():T.newValue(Pe)}},KB=class r{constructor(e){this.expr=e}evaluate(e,t){let n=!1,s=!1;for(let i of this.expr.params){let a=X(i).evaluate(e,t);switch(a.type){case"BOOLEAN":n=r.xor(n,!!a.value?.booleanValue);break;case"NULL":s=!0;break;default:return T.dr()}}return s?T.pr():T.newValue({booleanValue:n})}static xor(e,t){return(e||t)&&!(e&&t)}},ao=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,55094);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"NULL":n=!0;break;case"ERROR":case"UNSET":return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t);switch(i.type){case"ARRAY":break;case"NULL":n=!0;break;default:return T.dr()}if(n)return T.pr();for(let a of i.value?.arrayValue?.values??[])switch(nt(s.value)&&nt(a)?"EQ":kt(s.value,a)){case"EQ":return T.newValue($e);case"NOT_EQ":case"TYPE_MISMATCH":break;case"NULL":n=!0;break;default:Y(44608,{value:s.value,candidate:a})}return n?T.pr():T.newValue(Pe)}},zB=class{constructor(e){this.expr=e}evaluate(e,t){return new yr(new P("not",[new P("equal_any",this.expr.params)])).evaluate(e,t)}},QB=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,23322);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"INT":return T.newValue(Pe);case"DOUBLE":return T.newValue({booleanValue:isNaN(Le(n.value))});case"NULL":return T.pr();default:return T.dr()}}},$B=class{constructor(e){this.expr=e}evaluate(e,t){return $(this.expr.params.length===1,50406),new yr(new P("not",[new P("is_nan",this.expr.params)])).evaluate(e,t)}},WB=class{constructor(e){this.expr=e}evaluate(e,t){switch($(this.expr.params.length===1,23123),X(this.expr.params[0]).evaluate(e,t).type){case"NULL":return T.newValue($e);case"UNSET":case"ERROR":return T.dr();default:return T.newValue(Pe)}}},YB=class{constructor(e){this.expr=e}evaluate(e,t){return $(this.expr.params.length===1,23167),new yr(new P("not",[new P("is_null",this.expr.params)])).evaluate(e,t)}},XB=class{constructor(e){this.expr=e}evaluate(e,t){return $(this.expr.params.length===1,5228),X(this.expr.params[0]).evaluate(e,t).type==="ERROR"?T.newValue($e):T.newValue(Pe)}},ZB=class{constructor(e){this.expr=e}evaluate(e,t){switch($(this.expr.params.length===1,6877),X(this.expr.params[0]).evaluate(e,t).type){case"ERROR":return T.dr();case"UNSET":return T.newValue(Pe);default:return T.newValue($e)}}},eu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===3,11706);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"BOOLEAN":return n.value?.booleanValue?X(this.expr.params[1]).evaluate(e,t):X(this.expr.params[2]).evaluate(e,t);case"NULL":return X(this.expr.params[2]).evaluate(e,t);default:return T.dr()}}},tu=class{constructor(e){this.expr=e}evaluate(e,t){let n=this.expr.params.map((i=>X(i).evaluate(e,t))),s;for(let i of n)switch(i.type){case"ERROR":case"UNSET":case"NULL":continue;default:s=s===void 0||We(i.value,s.value)>0?i:s}return s===void 0?T.pr():s}},nu=class{constructor(e){this.expr=e}evaluate(e,t){let n=this.expr.params.map((i=>X(i).evaluate(e,t))),s;for(let i of n)switch(i.type){case"ERROR":case"UNSET":case"NULL":continue;default:s=s===void 0||We(i.value,s.value)<0?i:s}return s===void 0?T.pr():s}},on=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,31033,`${this.expr.name}() function should have exactly 2 params`);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"ERROR":case"UNSET":return T.dr()}let s=X(this.expr.params[1]).evaluate(e,t);switch(s.type){case"ERROR":case"UNSET":return T.dr()}return this.Cr(n,s)}},ru=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){if(e.yr()&&t.yr())return T.newValue($e);if(e.yr()||t.yr()||Ye(e.value)||Ye(t.value)||be(e.value)!==be(t.value))return T.newValue(Pe);switch(kt(e.value,t.value)){case"EQ":return T.newValue($e);case"NOT_EQ":return T.newValue(Pe);case"NULL":return T.pr();default:Y(44615,{left:e,right:t})}}},su=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){switch(kt(e.value,t.value)){case"EQ":return T.newValue(Pe);case"NOT_EQ":case"TYPE_MISMATCH":return T.newValue($e);case"NULL":return T.pr();default:Y(44614,{left:e,right:t})}}},iu=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){return be(e.value)!==be(t.value)||Ye(e.value)||Ye(t.value)?T.newValue(Pe):T.newValue({booleanValue:We(e.value,t.value)<0})}},ou=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){return be(e.value)!==be(t.value)||Ye(e.value)||Ye(t.value)?T.newValue(Pe):kt(e.value,t.value)==="EQ"?T.newValue($e):T.newValue({booleanValue:We(e.value,t.value)<0})}},au=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){return be(e.value)!==be(t.value)||Ye(e.value)||Ye(t.value)?T.newValue(Pe):T.newValue({booleanValue:We(e.value,t.value)>0})}},Bu=class extends on{constructor(e){super(e),this.expr=e}Cr(e,t){return be(e.value)!==be(t.value)||Ye(e.value)||Ye(t.value)?T.newValue(Pe):kt(e.value,t.value)==="EQ"?T.newValue($e):T.newValue({booleanValue:We(e.value,t.value)>0})}},uu=class{constructor(e){this.expr=e}evaluate(e,t){throw new Error("Unimplemented")}},cu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,216);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"NULL":return T.pr();case"ARRAY":{let s=n.value.arrayValue?.values??[];return T.newValue({arrayValue:{values:[...s].reverse()}})}default:return T.dr()}}},lu=class{constructor(e){this.expr=e}evaluate(e,t){return $(this.expr.params.length===2,52884),new ao(new P("eq_any",[this.expr.params[1],this.expr.params[0]])).evaluate(e,t)}},hu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,1392);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"ARRAY":break;case"NULL":n=!0;break;default:return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t);switch(i.type){case"ARRAY":break;case"NULL":n=!0;break;default:return T.dr()}if(n)return T.pr();let a=i.value?.arrayValue?.values??[],B=s.value?.arrayValue?.values??[];for(let u of a){let l=!1;n=!1;for(let f of B){switch(nt(u)&&nt(f)?"EQ":kt(u,f)){case"EQ":l=!0;break;case"NOT_EQ":case"TYPE_MISMATCH":break;case"NULL":n=!0;break;default:Y(44613,{value:f,search:u})}if(l)break}if(!l)return T.newValue(Pe)}return T.newValue($e)}},fu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,2680);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"ARRAY":break;case"NULL":n=!0;break;default:return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t);switch(i.type){case"ARRAY":break;case"NULL":n=!0;break;default:return T.dr()}if(n)return T.pr();let a=i.value?.arrayValue?.values??[],B=s.value?.arrayValue?.values??[];for(let u of B)for(let l of a)switch(nt(u)&&nt(l)?"EQ":kt(u,l)){case"EQ":return T.newValue($e);case"NOT_EQ":case"TYPE_MISMATCH":break;case"NULL":n=!0;break;default:Y(60403,{value:u,search:l})}return n?T.pr():T.newValue(Pe)}},du=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,38605);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"NULL":return T.pr();case"ARRAY":return T.newValue({integerValue:`${n.value?.arrayValue?.values?.length??0}`});default:return T.dr()}}},Cu=class{constructor(e){this.expr=e}evaluate(e,t){throw new Error("Unimplemented")}},pu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,1508);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"NULL":return T.pr();case"BYTES":{let s=n.value?.bytesValue;if(typeof s=="string"){let i=Ae.fromBase64String(s).toUint8Array();return i.reverse(),T.newValue({bytesValue:Ae.fromUint8Array(i).toBase64()})}return T.newValue({bytesValue:new Uint8Array(s).reverse()})}case"STRING":{let s=n.value?.stringValue,i=new Intl.__PRIVATE_Segmenter(void 0,{granularity:"grapheme"}).segment(s),a=Array.from(i,(B=>B.segment)).reverse();return T.newValue({stringValue:a.join("")})}default:return T.dr()}}},gu=class{constructor(e){this.expr=e}evaluate(e,t){throw new Error("Unimplemented")}},mu=class{constructor(e){this.expr=e}evaluate(e,t){throw new Error("Unimplemented")}},Eu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,19400);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"NULL":return T.pr();case"STRING":{let s=(function(a){let B=0;for(let u=0;u<a.length;u++){let l=a.codePointAt(u);if(l===void 0)return;if(l<=65535)if(l>=55296&&l<=57343)if(l<=56319){let f=a.codePointAt(u+1);f!==void 0&&f>=56320&&f<=57343?(B+=1,u++):B+=1}else B+=1;else B+=1;else{if(!(l<=1114111))return;B+=1,u++}}return B})(n.value.stringValue);return s===void 0?T.dr():T.newValue({integerValue:s})}default:return T.dr()}}},_u=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,8486);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"BYTES":{let s=n.value?.bytesValue;return typeof s=="string"?T.newValue({integerValue:Ae.fromBase64String(s).toUint8Array().length}):T.newValue({integerValue:new Uint8Array(s).length})}case"STRING":{let s=(function(a){let B=0;for(let u=0;u<a.length;u++){let l=a.codePointAt(u);if(l===void 0)return;if(l>=55296&&l<=57343){if(!(l<=56319))return;{let f=a.codePointAt(u+1);if(f===void 0||!(f>=56320&&f<=57343))return;B+=4,u++}}else if(l<=127)B+=1;else if(l<=2047)B+=2;else if(l<=65535)B+=3;else{if(!(l<=1114111))return;B+=4,u++}}return B})(n.value?.stringValue);return s===void 0?T.dr():T.newValue({integerValue:s})}case"NULL":return T.pr();default:return T.dr()}}},an=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,39773,`${this.expr.name}() function should have exactly two parameters`);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"STRING":break;case"NULL":n=!0;break;default:return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t);switch(i.type){case"STRING":break;case"NULL":n=!0;break;default:return T.dr()}return n?T.pr():this.Fr(s.value?.stringValue,i.value?.stringValue)}},Du=class extends an{Fr(e,t){try{let n=(function(a){let B="";for(let u=0;u<a.length;u++){let l=a.charAt(u);switch(l){case"_":B+=".";break;case"%":B+=".*";break;case"\\":case".":case"*":case"?":case"+":case"^":case"$":case"|":case"(":case")":case"[":case"]":case"{":case"}":B+="\\"+l;break;default:B+=l}}return"^"+B+"$"})(t),s=Ii.compile(n);return T.newValue({booleanValue:s.matches(e)})}catch(n){return ut(`Invalid LIKE pattern converted to regex: ${t}, returning error. Error: ${n}`),T.dr()}}},yu=class extends an{Fr(e,t){try{let n=Ii.compile(t);return T.newValue({booleanValue:n.test(e)})}catch{return ut(`Invalid regex pattern found in regex_contains: ${t}, returning error`),T.dr()}}},wu=class extends an{Fr(e,t){try{return T.newValue({booleanValue:Ii.compile(t).matches(e)})}catch{return ut(`Invalid regex pattern found in regex_match: ${t}, returning error`),T.dr()}}},Iu=class extends an{Fr(e,t){return T.newValue({booleanValue:e.includes(t)})}},Tu=class extends an{Fr(e,t){return T.newValue({booleanValue:e.startsWith(t)})}},Au=class extends an{Fr(e,t){return T.newValue({booleanValue:e.endsWith(t)})}},bu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,29079);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"STRING":return T.newValue({stringValue:n.value?.stringValue?.toLowerCase()});case"NULL":return T.pr();default:return T.dr()}}},vu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,60487);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"STRING":return T.newValue({stringValue:n.value?.stringValue?.toUpperCase()});case"NULL":return T.pr();default:return T.dr()}}},Su=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,28544);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"STRING":return T.newValue({stringValue:n.value?.stringValue?.trim()});case"NULL":return T.pr();default:return T.dr()}}},Ru=class{constructor(e){this.expr=e}evaluate(e,t){let n=this.expr.params.map((a=>X(a).evaluate(e,t))),s="",i=!1;for(let a of n)switch(a.type){case"STRING":s+=a.value.stringValue;break;case"NULL":i=!0;break;default:return T.dr()}return i?T.pr():T.newValue({stringValue:s})}},Nu=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,4483);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"UNSET":return T.mr();case"MAP":break;default:return T.dr()}let s=X(this.expr.params[1]).evaluate(e,t);if(s.type!=="STRING")return T.dr();let i=n.value?.mapValue?.fields?.[s.value?.stringValue];return i===void 0?T.mr():T.newValue(i)}},Rs=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===2,25231,`${this.expr.name}() function should have exactly 2 params`);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"VECTOR":break;case"NULL":n=!0;break;default:return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t);switch(i.type){case"VECTOR":break;case"NULL":n=!0;break;default:return T.dr()}if(n)return T.pr();let a=Xa(s.value),B=Xa(i.value);if(a===void 0||B===void 0||a.values?.length!==B.values?.length)return T.dr();let u=this.Or(a,B);return u===void 0||isNaN(u)?T.dr():T.newValue({doubleValue:u})}},Fu=class extends Rs{Or(e,t){let n=e?.values??[],s=t?.values??[];if(n.length===0)return;let i=0,a=0,B=0;for(let l=0;l<n.length;l++){if(!nn(n[l])||!nn(s[l]))return;let f=Le(n[l]),C=Le(s[l]);i+=f*C,a+=f*f,B+=C*C}let u=Math.sqrt(a)*Math.sqrt(B);if(u!==0)return 1-Math.max(-1,Math.min(1,i/u))}},xu=class extends Rs{Or(e,t){let n=e?.values??[],s=t?.values??[];if(n.length===0)return 0;let i=0;for(let a=0;a<n.length;a++){if(!nn(n[a])||!nn(s[a]))return;i+=Le(n[a])*Le(s[a])}return i}},Pu=class extends Rs{Or(e,t){let n=e?.values??[],s=t?.values??[];if(n.length===0)return 0;let i=0;for(let a=0;a<n.length;a++){if(!nn(n[a])||!nn(s[a]))return;let B=Le(n[a]),u=Le(s[a]);i+=Math.pow(B-u,2)}return Math.sqrt(i)}},Ou=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,39044);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"VECTOR":{let s=Xa(n.value);return T.newValue({integerValue:s?.values?.length??0})}case"NULL":return T.pr();default:return T.dr()}}},Ns=BigInt(-62135596800),Fs=BigInt(253402300799),Bo=BigInt(1e3),en=BigInt(1e6),hE=Ns*Bo,fE=Fs*Bo+BigInt(999),dE=Ns*en,CE=Fs*en+BigInt(999999);function Mc(r){return r>=dE&&r<=CE}function Xd(r){return r>=Ns&&r<=Fs}function xs(r,e){let t=BigInt(r);return!(t<Ns||t>Fs)&&!(e<0||e>=1e9)&&(t!==Ns||e===0)&&!(t===Fs&&e>999999999)}function Zd(r,e){return e<0?{seconds:r-1,nanos:e+1e9}:{seconds:r,nanos:e}}function Gc(r){return BigInt(r.seconds)*en+BigInt(Math.trunc(r.nanoseconds/1e3))}var Ps=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,49262,`${this.expr.name}() function should have exactly one parameter`);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"INT":return this.toTimestamp(BigInt(n.value.integerValue));case"NULL":return T.pr();default:return T.dr()}}},Lu=class extends Ps{toTimestamp(e){if(!Mc(e))return T.dr();let t=Number(e/en),n=Number(e%en*BigInt(1e3)),s=Zd(t,n);return t=s.seconds,n=s.nanos,xs(t,n)?T.newValue({timestampValue:{seconds:t,nanos:n}}):T.dr()}},Vu=class extends Ps{toTimestamp(e){if(!(function(a){return a>=hE&&a<=fE})(e))return T.dr();let t=Number(e/Bo),n=Number(e%Bo*BigInt(1e6)),s=Zd(t,n);return t=s.seconds,n=s.nanos,xs(t,n)?T.newValue({timestampValue:{seconds:t,nanos:n}}):T.dr()}},ku=class extends Ps{toTimestamp(e){if(!Xd(e))return T.dr();let t=Number(e);return T.newValue({timestampValue:{seconds:t,nanos:0}})}},Os=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===1,1265,`${this.expr.name}() function should have exactly one parameter`);let n=X(this.expr.params[0]).evaluate(e,t);switch(n.type){case"TIMESTAMP":break;case"NULL":return T.pr();default:return T.dr()}let s=Oc(n.value.timestampValue);return xs(s.seconds,s.nanoseconds)?this.Mr(s):T.dr()}},Mu=class extends Os{Mr(e){let t=Gc(e);return Mc(t)?T.newValue({integerValue:`${t.toString()}`}):T.dr()}},Gu=class extends Os{Mr(e){let t=Gc(e),n=t/BigInt(1e3),s=t%BigInt(1e3);return n>BigInt(0)||s===BigInt(0)?T.newValue({integerValue:n.toString()}):T.newValue({integerValue:(n-BigInt(1)).toString()})}},Hu=class extends Os{Mr(e){let t=BigInt(e.seconds);return Xd(t)?T.newValue({integerValue:t.toString()}):T.dr()}},uo=class{constructor(e){this.expr=e}evaluate(e,t){$(this.expr.params.length===3,2775,`${this.expr.name}() function should have exactly 3 parameters`);let n=!1,s=X(this.expr.params[0]).evaluate(e,t);switch(s.type){case"TIMESTAMP":break;case"NULL":n=!0;break;default:return T.dr()}let i=X(this.expr.params[1]).evaluate(e,t),a;switch(i.type){case"STRING":if(a=(function(re){switch(re){case"microsecond":return"microsecond";case"millisecond":return"millisecond";case"second":return"second";case"minute":return"minute";case"hour":return"hour";case"day":return"day";default:return}})(i.value.stringValue),a===void 0)return T.dr();break;case"NULL":n=!0;break;default:return T.dr()}let B=X(this.expr.params[2]).evaluate(e,t);switch(B.type){case"INT":break;case"NULL":n=!0;break;default:return T.dr()}if(n)return T.pr();let u=BigInt(B.value.integerValue),l;try{switch(a){case"microsecond":l=u;break;case"millisecond":l=u*BigInt(1e3);break;case"second":l=u*BigInt(1e6);break;case"minute":l=u*BigInt(6e7);break;case"hour":l=u*BigInt(36e8);break;case"day":l=u*BigInt(864e8);break;default:return T.dr()}if(a!=="microsecond"&&u!==BigInt(0)&&l/u!==BigInt(this.Nr(a)))return T.dr()}catch(z){return ut(`Error during timestamp arithmetic: ${z}`),T.dr()}let f=Oc(s.value.timestampValue);if(!xs(f.seconds,f.nanoseconds))return T.dr();let C=Gc(f),D=this.Lr(C,l);if(!Mc(D))return T.dr();let v=Number(D/en),R=D%en,V=Number((R<0?R+en:R)*BigInt(1e3)),H=R<0?v-1:v;return xs(H,V)?T.newValue({timestampValue:{seconds:H,nanos:V}}):T.dr()}Nr(e){switch(e){case"millisecond":return 1e3;case"second":return 1e6;case"minute":return 6e7;case"hour":return 36e8;case"day":return 864e8;default:return 1}}},Uu=class extends uo{Lr(e,t){return e+t}},qu=class extends uo{Lr(e,t){return e-t}};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ls(r){if((r=Yd(r))instanceof xn)return`fld(${r.fieldName})`;if(r instanceof Er)return`cst(${(function(t){return t===null?"null":typeof t=="number"?t.toString():typeof t=="string"?`"${t}"`:t instanceof Oe?`ref(${t.path})`:t instanceof st?`vec(${JSON.stringify(t)})`:JSON.stringify(t)})(r.value)})`;if(r instanceof P)return`fn(${r.name},[${r.params.map(Ls).join(",")}])`;if(r.expressionType==="ListOfExpressions")return`list([${r.ur.map(Ls).join(",")}])`;throw new Error(`Unrecognized expr ${JSON.stringify(r,null,2)}`)}function pE(r){if(r instanceof ro)return`${r._name}(${vi(r.fields)})`;if(r instanceof so){let e=`${r._name}(${vi(r.accumulators)})`;return r.groups.size>0&&(e+=`grouping(${vi(r.groups)})`),e}if(r instanceof io)return`${r._name}(${vi(r.groups)})`;if(r instanceof _r)return`${r._name}(${r.Er})`;if(r instanceof Dr)return`${r._name}(${r.collectionId})`;if(r instanceof As)return`${r._name}()`;if(r instanceof bs)return`${r._name}(${r.hr.sort()})`;if(r instanceof vs)return`${r._name}(${Ls(r.condition)})`;if(r instanceof Pn)return`${r._name}(${r.limit})`;if(r instanceof Ss)return`${r._name}(${(function(t){return t.map((n=>`${Ls(n.expr)}${n.direction}`)).join(",")})(r.orderings)})`;throw new Error(`Unrecognized stage ${r._name}`)}function vi(r){return`${Array.from(r.entries()).sort().map((([e,t])=>`${e}=${Ls(t)}`)).join(",")}`}function Ft(r){return r.stages.map((e=>pE(e))).join("|")}function eC(r,e){return Ft(r)===Ft(e)}function Se(r){return r instanceof Ge}function Jf(r){return Se(r)?Ft(r):os(r)}function tC(r){return Se(r)?Ft(r):(function(t){return`${Ad(_t(t))}|lt:${t.limitType}`})(r)}function xo(r,e){return r instanceof Ge&&e instanceof Ge?eC(r,e):!(r instanceof Ge&&!(e instanceof Ge)||!(r instanceof Ge)&&e instanceof Ge)&&mm(r,e)}function nC(r){return Dn(r)?Ft(r):Ad(r)}function rC(r,e){return r instanceof Ge&&e instanceof Ge?eC(r,e):!(r instanceof Ge&&!(e instanceof Ge)||!(r instanceof Ge)&&e instanceof Ge)&&bd(r,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ju=class{constructor(e,t,n,s){this.batchId=e,this.localWriteTime=t,this.baseMutations=n,this.mutations=s}applyToRemoteDocument(e,t){let n=t.mutationResults;for(let s=0;s<this.mutations.length;s++){let i=this.mutations[s];i.key.isEqual(e.key)&&um(i,e,n[s])}}applyToLocalView(e,t){for(let n of this.baseMutations)n.key.isEqual(e.key)&&(t=is(n,e,t,this.localWriteTime));for(let n of this.mutations)n.key.isEqual(e.key)&&(t=is(n,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){let n=Fd();return this.mutations.forEach((s=>{let i=e.get(s.key),a=i.overlayedDocument,B=this.applyToLocalView(a,i.mutatedFields);B=t.has(s.key)?null:B;let u=Ed(a,B);u!==null&&n.set(s.key,u),a.isValidDocument()||a.convertToNoDocument(Z.min())})),n}keys(){return this.mutations.reduce(((e,t)=>e.add(t.key)),ie())}isEqual(e){return this.batchId===e.batchId&&sr(this.mutations,e.mutations,((t,n)=>bf(t,n)))&&sr(this.baseMutations,e.baseMutations,((t,n)=>bf(t,n)))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var sC="";function gE(r){let e="";for(let t=0;t<r.length;t++)e.length>0&&(e=Kf(e)),e=mE(r.get(t),e);return Kf(e)}function mE(r,e){let t=e,n=r.length;for(let s=0;s<n;s++){let i=r.charAt(s);switch(i){case"\0":t+="";break;case sC:t+="";break;default:t+=i}}return t}function Kf(r){return r+sC+""}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var EE="remoteDocuments",iC="owner";var oC="mutationQueues";var aC="mutations";/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var BC="documentMutations",_E="remoteDocumentsV14";var uC="remoteDocumentGlobal";var cC="targets";var lC="targetDocuments";var hC="targetGlobal",fC="collectionParents";var dC="clientMetadata";var CC="bundles";var pC="namedQueries";var DE="indexConfiguration";var yE="indexState";var wE="indexEntries";var gC="documentOverlays";var IE="globals";var TE=[oC,aC,BC,EE,cC,iC,hC,lC,dC,uC,fC,CC,pC],xD=[...TE,gC],AE=[oC,aC,BC,_E,cC,iC,hC,lC,dC,uC,fC,CC,pC,gC],bE=AE,vE=[...bE,DE,yE,wE];var PD=[...vE,IE];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ju=class{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var wr=class r{constructor(e,t,n,s,i=Z.min(),a=Z.min(),B=Ae.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=n,this.sequenceNumber=s,this.snapshotVersion=i,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=B,this.expectedCount=u}withSequenceNumber(e){return new r(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new r(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new r(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new r(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ku=class{constructor(e){this.qr=e}};function SE(r){let e=Lm({parent:r.parent,structuredQuery:r.structuredQuery});return r.limitType==="LAST"?Gi(e,e.limit,"L"):e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var co=class{constructor(){}Xr(e,t){this.ei(e,t),t.ti()}ei(e,t){if("nullValue"in e)this.ni(t,5);else if("booleanValue"in e)this.ni(t,10),t.ri(e.booleanValue?1:0);else if("integerValue"in e)this.ni(t,15),t.ri(Ce(e.integerValue));else if("doubleValue"in e){let n=Ce(e.doubleValue);isNaN(n)?this.ni(t,13):(this.ni(t,15),ar(n)?t.ri(0):t.ri(n))}else if("timestampValue"in e){let n=e.timestampValue;this.ni(t,20),typeof n=="string"&&(n=Pt(n)),t.ii(`${n.seconds||""}`),t.ri(n.nanos||0)}else if("stringValue"in e)this.si(e.stringValue,t),this._i(t);else if("bytesValue"in e)this.ni(t,30),t.oi(Ot(e.bytesValue)),this._i(t);else if("referenceValue"in e)this.ai(e.referenceValue,t);else if("geoPointValue"in e){let n=e.geoPointValue;this.ni(t,45),t.ri(n.latitude||0),t.ri(n.longitude||0)}else"mapValue"in e?Cd(e)?this.ni(t,Number.MAX_SAFE_INTEGER):ls(e)?this.ui(e.mapValue,t):(this.ci(e.mapValue,t),this._i(t)):"arrayValue"in e?(this.li(e.arrayValue,t),this._i(t)):Y(19022,{Ei:e})}si(e,t){this.ni(t,25),this.hi(e,t)}hi(e,t){t.ii(e)}ci(e,t){let n=e.fields||{};this.ni(t,55);for(let s of Object.keys(n))this.si(s,t),this.ei(n[s],t)}ui(e,t){let n=e.fields||{};this.ni(t,53);let s=Sn,i=n[s].arrayValue?.values?.length||0;this.ni(t,15),t.ri(Ce(i)),this.si(s,t),this.ei(n[s],t)}li(e,t){let n=e.values||[];this.ni(t,50);for(let s of n)this.ei(s,t)}ai(e,t){this.ni(t,37),Q.fromName(e).path.forEach((n=>{this.ni(t,60),this.hi(n,t)}))}ni(e,t){e.ri(t)}_i(e){e.ri(2)}};co.Ti=new co;/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law | agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES | CONDITIONS OF ANY KIND, either express | implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var zu=class{constructor(){this.Yi=new Qu}addToCollectionParentIndex(e,t){return this.Yi.add(t),L.resolve()}getCollectionParents(e,t){return L.resolve(this.Yi.getEntries(t))}addFieldIndex(e,t){return L.resolve()}deleteFieldIndex(e,t){return L.resolve()}deleteAllFieldIndexes(e){return L.resolve()}createTargetIndexes(e,t){return L.resolve()}getDocumentsMatchingTarget(e,t){return L.resolve(null)}getIndexType(e,t){return L.resolve(0)}getFieldIndexes(e,t){return L.resolve([])}getNextCollectionGroupToUpdate(e){return L.resolve(null)}getMinOffset(e,t){return L.resolve(Fn.min())}getMinOffsetFromCollectionGroup(e,t){return L.resolve(Fn.min())}updateCollectionGroup(e,t,n){return L.resolve()}updateIndexEntries(e,t){return L.resolve()}},Qu=class{constructor(){this.index={}}add(e){let t=e.lastSegment(),n=e.popLast(),s=this.index[t]||new Re(le.comparator),i=!s.has(n);return this.index[t]=s.add(n),i}has(e){let t=e.lastSegment(),n=e.popLast(),s=this.index[t];return s&&s.has(n)}getEntries(e){return(this.index[e]||new Re(le.comparator)).toArray()}};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var OD=new Uint8Array(0);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ln=class r{constructor(e){this.gs=e}next(){return this.gs+=2,this.gs}static ys(){return new r(0)}static ws(){return new r(-1)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */// Copyright 2024 Google LLC* @license
function mC(r,e){let t=e;for(let n of r.stages)t=NE({serializer:r.serializer,serverTimestampBehavior:r.listenOptions?.serverTimestampBehavior},n,t);return t}function Po(r,e){return mC(r,[e]).length>0}function RE(r,e){return Se(r)?Po(r,e):To(r,e)}function NE(r,e,t){if(e instanceof _r)return(function(s,i,a){return a.filter((B=>B.isFoundDocument()&&`/${B.key.getCollectionPath().canonicalString()}`===i.Er))})(0,e,t);if(e instanceof vs)return(function(s,i,a){return a.filter((B=>{let u=Bs(X(i.condition).evaluate(s,B));return u!==void 0&&ct(u,$e)}))})(r,e,t);if(e instanceof Dr)return(function(s,i,a){return a.filter((B=>B.isFoundDocument()&&B.key.getCollectionPath().lastSegment()===i.collectionId))})(0,e,t);if(e instanceof As)return(function(s,i,a){return a.filter((B=>B.isFoundDocument()))})(0,0,t);if(e instanceof bs)return(function(s,i,a){return a.filter((B=>B.isFoundDocument()&&i.Tr.has(B.key.path.toStringWithLeadingSlash())))})(0,e,t);if(e instanceof Pn)return(function(s,i,a){return a.slice(0,i.limit)})(0,e,t);if(e instanceof Ss)return(function(s,i,a){let B=i.orderings.map((u=>({Os:X(u.expr),direction:u.direction})));return[...a].sort(((u,l)=>{for(let{Os:f,direction:C}of B){let D=Bs(f.evaluate(s,u)),v=Bs(f.evaluate(s,l)),R=We(D??Br,v??Br);if(R!==0)return C==="ascending"?R:-R}return 0}))})(r,e,t);throw new Error(`Unknown stage: ${e._name}`)}function $u(r){let e=(function(n){for(let s=n.stages.length-1;s>=0;s--){let i=n.stages[s];if(i instanceof Ss)return i.orderings}throw new Error("Pipeline must contain at least one Sort stage")})(r);return(t,n)=>{for(let s of e){let i=Bs(X(s.expr).evaluate({serializer:r.serializer},t)),a=Bs(X(s.expr).evaluate({serializer:r.serializer},n)),B=We(i||Br,a||Br);if(B!==0)return s.direction==="ascending"?B:-B}return 0}}function Ka(r){for(let e=r.stages.length-1;e>=0;e--){let t=r.stages[e];if(t instanceof Pn)return{limit:t.limit}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Wu=class{constructor(){this.changes=new Lt((e=>e.toString()),((e,t)=>e.isEqual(t))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,dt.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();let n=this.changes.get(t);return n!==void 0?L.resolve(n):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Yu=class{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Xu=class{constructor(e,t,n,s){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=n,this.indexManager=s}getDocument(e,t){let n=null;return this.documentOverlayCache.getOverlay(e,t).next((s=>(n=s,this.remoteDocumentCache.getEntry(e,t)))).next((s=>(n!==null&&is(n.mutation,s,yn.empty(),Te.now()),s)))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next((n=>this.getLocalViewOfDocuments(e,n,ie()).next((()=>n))))}getLocalViewOfDocuments(e,t,n=ie()){let s=Wt();return this.populateOverlays(e,s,t).next((()=>this.computeViews(e,t,s,n).next((i=>{let a=Qn();return i.forEach(((B,u)=>{a=a.insert(B,u.overlayedDocument)})),a}))))}getOverlayedDocuments(e,t){let n=Wt();return this.populateOverlays(e,n,t).next((()=>this.computeViews(e,t,n,ie())))}populateOverlays(e,t,n){let s=[];return n.forEach((i=>{t.has(i)||s.push(i)})),this.documentOverlayCache.getOverlays(e,s).next((i=>{i.forEach(((a,B)=>{t.set(a,B)}))}))}computeViews(e,t,n,s){let i=rt(),a=as(),B=(function(){return as()})();return t.forEach(((u,l)=>{let f=n.get(l.key);s.has(l.key)&&(f===void 0||f.mutation instanceof Cr)?i=i.insert(l.key,l):f!==void 0?(a.set(l.key,f.mutation.getFieldMask()),is(f.mutation,l,f.mutation.getFieldMask(),Te.now())):a.set(l.key,yn.empty())})),this.recalculateAndSaveOverlays(e,i).next((u=>(u.forEach(((l,f)=>a.set(l,f))),t.forEach(((l,f)=>B.set(l,new Yu(f,a.get(l)??null)))),B)))}recalculateAndSaveOverlays(e,t){let n=as(),s=new _e(((a,B)=>a-B)),i=ie();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next((a=>{for(let B of a)B.keys().forEach((u=>{let l=t.get(u);if(l===null)return;let f=n.get(u)||yn.empty();f=B.applyToLocalView(l,f),n.set(u,f);let C=(s.get(B.batchId)||ie()).add(u);s=s.insert(B.batchId,C)}))})).next((()=>{let a=[],B=s.getReverseIterator();for(;B.hasNext();){let u=B.getNext(),l=u.key,f=u.value,C=Fd();f.forEach((D=>{if(!i.has(D)){let v=Ed(t.get(D),n.get(D));v!==null&&C.set(D,v),i=i.add(D)}})),a.push(this.documentOverlayCache.saveOverlays(e,l,C))}return L.waitFor(a)})).next((()=>n))}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next((n=>this.recalculateAndSaveOverlays(e,n)))}getDocumentsMatchingQuery(e,t,n,s){return Se(t)?this.getDocumentsMatchingPipeline(e,t,n,s):pm(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):Sd(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,n,s):this.getDocumentsMatchingCollectionQuery(e,t,n,s)}getNextDocuments(e,t,n,s){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,n,s).next((i=>{let a=s-i.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,n.largestBatchId,s-i.size):L.resolve(Wt()),B=ms,u=i;return a.next((l=>L.forEach(l,((f,C)=>(B<C.largestBatchId&&(B=C.largestBatchId),i.get(f)?L.resolve():this.remoteDocumentCache.getEntry(e,f).next((D=>{u=u.insert(f,D)}))))).next((()=>this.populateOverlays(e,l,i))).next((()=>this.computeViews(e,u,l,ie()))).next((f=>({batchId:B,changes:Dm(f)})))))}))}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new Q(t)).next((n=>{let s=Qn();return n.isFoundDocument()&&(s=s.insert(n.key,n)),s}))}getDocumentsMatchingCollectionGroupQuery(e,t,n,s){let i=t.collectionGroup,a=Qn();return this.indexManager.getCollectionParents(e,i).next((B=>L.forEach(B,(u=>{let l=(function(C,D){return new pr(D,null,C.explicitOrderBy.slice(),C.filters.slice(),C.limit,C.limitType,C.startAt,C.endAt)})(t,u.child(i));return this.getDocumentsMatchingCollectionQuery(e,l,n,s).next((f=>{f.forEach(((C,D)=>{a=a.insert(C,D)}))}))})).next((()=>a))))}getDocumentsMatchingCollectionQuery(e,t,n,s){let i;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,n.largestBatchId).next((a=>(i=a,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,n,i,s)))).next((a=>this.retrieveMatchingLocalDocuments(i,a,(B=>To(t,B)))))}getDocumentsMatchingPipeline(e,t,n,s){if(Zt(t)==="collection_group"){let i=kc(t),a=Qn();return this.indexManager.getCollectionParents(e,i).next((B=>L.forEach(B,(u=>{let l=(function(C,D){let v=C.stages.map((R=>R instanceof Dr?new _r(D.canonicalString(),{}):R));return new Ge(C.serializer,v)})(t,u.child(i));return this.getDocumentsMatchingPipeline(e,l,n,s).next((f=>{f.forEach(((C,D)=>{a=a.insert(C,D)}))}))})).next((()=>a))))}{let i;return this.getOverlaysForPipeline(e,t,n.largestBatchId).next((a=>{switch(i=a,Zt(t)){case"collection":return this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,n,i,s);case"documents":let B=ie();for(let u of OB(t))B=B.add(Q.fromPath(u));return this.remoteDocumentCache.getEntries(e,B);case"database":return this.remoteDocumentCache.getAllEntries(e);default:throw new j("invalid-argument",`Invalid pipeline source to execute offline: ${Ft(t)}`)}})).next((a=>this.retrieveMatchingLocalDocuments(i,a,(B=>Po(t,B)))))}}retrieveMatchingLocalDocuments(e,t,n){e.forEach(((i,a)=>{let B=a.getKey();t.get(B)===null&&(t=t.insert(B,dt.newInvalidDocument(B)))}));let s=Qn();return t.forEach(((i,a)=>{let B=e.get(i);B!==void 0&&is(B.mutation,a,yn.empty(),Te.now()),n(a)&&(s=s.insert(i,a))})),s}getOverlaysForPipeline(e,t,n){switch(Zt(t)){case"collection":return this.documentOverlayCache.getOverlaysForCollection(e,le.fromString(Fo(t)),n);case"collection_group":throw new j("invalid-argument",`Unexpected collection group pipeline: ${Ft(t)}`);case"documents":return this.documentOverlayCache.getOverlays(e,OB(t).map((s=>Q.fromPath(s))));case"database":return this.documentOverlayCache.getAllOverlays(e,n);default:throw new j("invalid-argument",`Failed to get overlays for pipeline: ${Ft(t)}`)}}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Zu=class{constructor(e){this.serializer=e,this.Ks=new Map,this.Qs=new Map}getBundleMetadata(e,t){return L.resolve(this.Ks.get(t))}saveBundleMetadata(e,t){return this.Ks.set(t.id,(function(s){return{id:s.id,version:s.version,createTime:nr(s.createTime)}})(t)),L.resolve()}getNamedQuery(e,t){return L.resolve(this.Qs.get(t))}saveNamedQuery(e,t){return this.Qs.set(t.name,(function(s){return{name:s.name,query:SE(s.bundledQuery),readTime:nr(s.readTime)}})(t)),L.resolve()}};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ec=class{constructor(){this.overlays=new _e(Q.comparator),this.Ws=new Map}getOverlay(e,t){return L.resolve(this.overlays.get(t))}getOverlays(e,t){let n=Wt();return L.forEach(t,(s=>this.getOverlay(e,s).next((i=>{i!==null&&n.set(s,i)})))).next((()=>n))}getAllOverlays(e,t){let n=Wt();return this.overlays.forEach(((s,i)=>{i.largestBatchId>t&&n.set(s,i)})),L.resolve(n)}saveOverlays(e,t,n){return n.forEach(((s,i)=>{this.Yr(e,t,i)})),L.resolve()}removeOverlaysForBatchId(e,t,n){let s=this.Ws.get(n);return s!==void 0&&(s.forEach((i=>this.overlays=this.overlays.remove(i))),this.Ws.delete(n)),L.resolve()}getOverlaysForCollection(e,t,n){let s=Wt(),i=t.length+1,a=new Q(t.child("")),B=this.overlays.getIteratorFrom(a);for(;B.hasNext();){let u=B.getNext().value,l=u.getKey();if(!t.isPrefixOf(l.path))break;l.path.length===i&&u.largestBatchId>n&&s.set(u.getKey(),u)}return L.resolve(s)}getOverlaysForCollectionGroup(e,t,n,s){let i=new _e(((l,f)=>l-f)),a=this.overlays.getIterator();for(;a.hasNext();){let l=a.getNext().value;if(l.getKey().getCollectionGroup()===t&&l.largestBatchId>n){let f=i.get(l.largestBatchId);f===null&&(f=Wt(),i=i.insert(l.largestBatchId,f)),f.set(l.getKey(),l)}}let B=Wt(),u=i.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach(((l,f)=>B.set(l,f))),!(B.size()>=s)););return L.resolve(B)}Yr(e,t,n){let s=this.overlays.get(n.key);if(s!==null){let a=this.Ws.get(s.largestBatchId).delete(n.key);this.Ws.set(s.largestBatchId,a)}this.overlays=this.overlays.insert(n.key,new Ju(t,n));let i=this.Ws.get(t);i===void 0&&(i=ie(),this.Ws.set(t,i)),this.Ws.set(t,i.add(n.key))}};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var tc=class{constructor(){this.sessionToken=Ae.EMPTY_BYTE_STRING}getSessionToken(e){return L.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,L.resolve()}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Vs=class{constructor(){this.Gs=new Re(ye.zs),this.js=new Re(ye.Hs)}isEmpty(){return this.Gs.isEmpty()}addReference(e,t){let n=new ye(e,t);this.Gs=this.Gs.add(n),this.js=this.js.add(n)}Js(e,t){e.forEach((n=>this.addReference(n,t)))}removeReference(e,t){this.Ys(new ye(e,t))}Zs(e,t){e.forEach((n=>this.removeReference(n,t)))}Xs(e){let t=new Q(new le([])),n=new ye(t,e),s=new ye(t,e+1),i=[];return this.js.forEachInRange([n,s],(a=>{this.Ys(a),i.push(a.key)})),i}e_(){this.Gs.forEach((e=>this.Ys(e)))}Ys(e){this.Gs=this.Gs.delete(e),this.js=this.js.delete(e)}t_(e){let t=new Q(new le([])),n=new ye(t,e),s=new ye(t,e+1),i=ie();return this.js.forEachInRange([n,s],(a=>{i=i.add(a.key)})),i}containsKey(e){let t=new ye(e,0),n=this.Gs.firstAfterOrEqual(t);return n!==null&&e.isEqual(n.key)}},ye=class{constructor(e,t){this.key=e,this.n_=t}static zs(e,t){return Q.comparator(e.key,t.key)||ne(e.n_,t.n_)}static Hs(e,t){return ne(e.n_,t.n_)||Q.comparator(e.key,t.key)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var nc=class{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.Wr=1,this.r_=new Re(ye.zs)}checkEmpty(e){return L.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,n,s){let i=this.Wr;this.Wr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];let a=new ju(i,t,n,s);this.mutationQueue.push(a);for(let B of s)this.r_=this.r_.add(new ye(B.key,i)),this.indexManager.addToCollectionParentIndex(e,B.key.path.popLast());return L.resolve(a)}lookupMutationBatch(e,t){return L.resolve(this.i_(t))}getNextMutationBatchAfterBatchId(e,t){let n=t+1,s=this.s_(n),i=s<0?0:s;return L.resolve(this.mutationQueue.length>i?this.mutationQueue[i]:null)}getHighestUnacknowledgedBatchId(){return L.resolve(this.mutationQueue.length===0?nm:this.Wr-1)}getAllMutationBatches(e){return L.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){let n=new ye(t,0),s=new ye(t,Number.POSITIVE_INFINITY),i=[];return this.r_.forEachInRange([n,s],(a=>{let B=this.i_(a.n_);i.push(B)})),L.resolve(i)}getAllMutationBatchesAffectingDocumentKeys(e,t){let n=new Re(ne);return t.forEach((s=>{let i=new ye(s,0),a=new ye(s,Number.POSITIVE_INFINITY);this.r_.forEachInRange([i,a],(B=>{n=n.add(B.n_)}))})),L.resolve(this.__(n))}getAllMutationBatchesAffectingQuery(e,t){let n=t.path,s=n.length+1,i=n;Q.isDocumentKey(i)||(i=i.child(""));let a=new ye(new Q(i),0),B=new Re(ne);return this.r_.forEachWhile((u=>{let l=u.key.path;return!!n.isPrefixOf(l)&&(l.length===s&&(B=B.add(u.n_)),!0)}),a),L.resolve(this.__(B))}__(e){let t=[];return e.forEach((n=>{let s=this.i_(n);s!==null&&t.push(s)})),t}removeMutationBatch(e,t){$(this.o_(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let n=this.r_;return L.forEach(t.mutations,(s=>{let i=new ye(s.key,t.batchId);return n=n.delete(i),this.referenceDelegate.markPotentiallyOrphaned(e,s.key)})).next((()=>{this.r_=n}))}jr(e){}containsKey(e,t){let n=new ye(t,0),s=this.r_.firstAfterOrEqual(n);return L.resolve(t.isEqual(s&&s.key))}performConsistencyCheck(e){return this.mutationQueue.length,L.resolve()}o_(e,t){return this.s_(e)}s_(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}i_(e){let t=this.s_(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var rc=class{constructor(e){this.a_=e,this.docs=(function(){return new _e(Q.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){let n=t.key,s=this.docs.get(n),i=s?s.size:0,a=this.a_(t);return this.docs=this.docs.insert(n,{document:t.mutableCopy(),size:a}),this.size+=a-i,this.indexManager.addToCollectionParentIndex(e,n.path.popLast())}removeEntry(e){let t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){let n=this.docs.get(t);return L.resolve(n?n.document.mutableCopy():dt.newInvalidDocument(t))}getEntries(e,t){let n=rt();return t.forEach((s=>{let i=this.docs.get(s);n=n.insert(s,i?i.document.mutableCopy():dt.newInvalidDocument(s))})),L.resolve(n)}getAllEntries(e){let t=rt();return this.docs.forEach(((n,s)=>{t=t.insert(n,s.document)})),L.resolve(t)}getDocumentsMatchingQuery(e,t,n,s){let i,a;Se(t)?(i=le.fromString(Fo(t)),a=f=>Po(t,f)):(i=t.path,a=f=>To(t,f));let B=rt(),u=new Q(i.child("__id-9223372036854775808__")),l=this.docs.getIteratorFrom(u);for(;l.hasNext();){let{key:f,value:{document:C}}=l.getNext();if(!i.isPrefixOf(f.path))break;f.path.length>i.length+1||dm(fm(C),n)<=0||(s.has(C.key)||a(C))&&(B=B.insert(C.key,C.mutableCopy()))}return L.resolve(B)}getAllFromCollectionGroup(e,t,n,s){Y(9500)}u_(e,t){return L.forEach(this.docs,(n=>t(n)))}newChangeBuffer(e){return new sc(this)}getSize(e){return L.resolve(this.size)}},sc=class extends Wu{constructor(e){super(),this.qs=e}applyChanges(e){let t=[];return this.changes.forEach(((n,s)=>{s.isValidDocument()?t.push(this.qs.addEntry(e,s)):this.qs.removeEntry(n)})),L.waitFor(t)}getFromCache(e,t){return this.qs.getEntry(e,t)}getAllFromCache(e,t){return this.qs.getEntries(e,t)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ic=class{constructor(e){this.persistence=e,this.c_=new Lt((t=>nC(t)),rC),this.lastRemoteSnapshotVersion=Z.min(),this.highestTargetId=0,this.l_=0,this.E_=new Vs,this.targetCount=0,this.h_=Ln.ys()}forEachTarget(e,t){return this.c_.forEach(((n,s)=>t(s))),L.resolve()}getLastRemoteSnapshotVersion(e){return L.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return L.resolve(this.l_)}allocateTargetId(e){return this.highestTargetId=this.h_.next(),L.resolve(this.highestTargetId)}setTargetsMetadata(e,t,n){return n&&(this.lastRemoteSnapshotVersion=n),t>this.l_&&(this.l_=t),L.resolve()}vs(e){this.c_.set(e.target,e);let t=e.targetId;t>this.highestTargetId&&(this.h_=new Ln(t),this.highestTargetId=t),e.sequenceNumber>this.l_&&(this.l_=e.sequenceNumber)}addTargetData(e,t){return this.vs(t),this.targetCount+=1,L.resolve()}updateTargetData(e,t){return this.vs(t),L.resolve()}removeTargetData(e,t){return this.c_.delete(t.target),this.E_.Xs(t.targetId),this.targetCount-=1,L.resolve()}removeTargets(e,t,n){let s=0,i=[];return this.c_.forEach(((a,B)=>{B.sequenceNumber<=t&&n.get(B.targetId)===null&&(this.c_.delete(a),i.push(this.removeMatchingKeysForTargetId(e,B.targetId)),s++)})),L.waitFor(i).next((()=>s))}getTargetCount(e){return L.resolve(this.targetCount)}getTargetData(e,t){let n=this.c_.get(t)||null;return L.resolve(n)}addMatchingKeys(e,t,n){return this.E_.Js(t,n),L.resolve()}removeMatchingKeys(e,t,n){this.E_.Zs(t,n);let s=this.persistence.referenceDelegate,i=[];return s&&t.forEach((a=>{i.push(s.markPotentiallyOrphaned(e,a))})),L.waitFor(i)}removeMatchingKeysForTargetId(e,t){return this.E_.Xs(t),L.resolve()}getMatchingKeysForTargetId(e,t){let n=this.E_.t_(t);return L.resolve(n)}containsKey(e,t){return L.resolve(this.E_.containsKey(t))}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var lo=class{constructor(e,t){this.T_={},this.overlays={},this.P_=new mr(0),this.R_=!1,this.R_=!0,this.I_=new tc,this.referenceDelegate=e(this),this.A_=new ic(this),this.indexManager=new zu,this.remoteDocumentCache=(function(s){return new rc(s)})((n=>this.referenceDelegate.V_(n))),this.serializer=new Ku(t),this.d_=new Zu(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.R_=!1,Promise.resolve()}get started(){return this.R_}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new ec,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let n=this.T_[e.toKey()];return n||(n=new nc(t,this.referenceDelegate),this.T_[e.toKey()]=n),n}getGlobalsCache(){return this.I_}getTargetCache(){return this.A_}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.d_}runTransaction(e,t,n){U("MemoryPersistence","Starting transaction:",e);let s=new oc(this.P_.next());return this.referenceDelegate.f_(),n(s).next((i=>this.referenceDelegate.m_(s).next((()=>i)))).toPromise().then((i=>(s.raiseOnCommittedEvent(),i)))}p_(e,t){return L.or(Object.values(this.T_).map((n=>()=>n.containsKey(e,t))))}},oc=class extends TB{constructor(e){super(),this.currentSequenceNumber=e}},ac=class r{constructor(e){this.persistence=e,this.g_=new Vs,this.y_=null}static w_(e){return new r(e)}get b_(){if(this.y_)return this.y_;throw Y(60996)}addReference(e,t,n){return this.g_.addReference(n,t),this.b_.delete(n.toString()),L.resolve()}removeReference(e,t,n){return this.g_.removeReference(n,t),this.b_.add(n.toString()),L.resolve()}markPotentiallyOrphaned(e,t){return this.b_.add(t.toString()),L.resolve()}removeTarget(e,t){this.g_.Xs(t.targetId).forEach((s=>this.b_.add(s.toString())));let n=this.persistence.getTargetCache();return n.getMatchingKeysForTargetId(e,t.targetId).next((s=>{s.forEach((i=>this.b_.add(i.toString())))})).next((()=>n.removeTargetData(e,t)))}f_(){this.y_=new Set}m_(e){let t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return L.forEach(this.b_,(n=>{let s=Q.fromPath(n);return this.S_(e,s).next((i=>{i||t.removeEntry(s,Z.min())}))})).next((()=>(this.y_=null,t.apply(e))))}updateLimboDocument(e,t){return this.S_(e,t).next((n=>{n?this.b_.delete(t.toString()):this.b_.add(t.toString())}))}V_(e){return 0}S_(e,t){return L.or([()=>L.resolve(this.g_.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.p_(e,t)])}},ho=class r{constructor(e,t){this.persistence=e,this.v_=new Lt((n=>gE(n.path)),((n,s)=>n.isEqual(s))),this.garbageCollector=Wm(this,t)}static w_(e,t){return new r(e,t)}f_(){}m_(e){return L.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}rr(e){let t=this.xs(e);return this.persistence.getTargetCache().getTargetCount(e).next((n=>t.next((s=>n+s))))}xs(e){let t=0;return this.ir(e,(n=>{t++})).next((()=>t))}ir(e,t){return L.forEach(this.v_,((n,s)=>this.Fs(e,n,s).next((i=>i?L.resolve():t(s)))))}removeTargets(e,t,n){return this.persistence.getTargetCache().removeTargets(e,t,n)}removeOrphanedDocuments(e,t){let n=0,s=this.persistence.getRemoteDocumentCache(),i=s.newChangeBuffer();return s.u_(e,(a=>this.Fs(e,a,t).next((B=>{B||(n++,i.removeEntry(a,Z.min()))})))).next((()=>i.apply(e))).next((()=>n))}markPotentiallyOrphaned(e,t){return this.v_.set(t,e.currentSequenceNumber),L.resolve()}removeTarget(e,t){let n=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,n)}addReference(e,t,n){return this.v_.set(n,e.currentSequenceNumber),L.resolve()}removeReference(e,t,n){return this.v_.set(n,e.currentSequenceNumber),L.resolve()}updateLimboDocument(e,t){return this.v_.set(t,e.currentSequenceNumber),L.resolve()}V_(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=Si(e.data.value)),t}Fs(e,t,n){return L.or([()=>this.persistence.p_(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{let s=this.v_.get(t);return L.resolve(s!==void 0&&s>n)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Bc=class r{constructor(e,t,n,s){this.targetId=e,this.fromCache=t,this.Ao=n,this.Vo=s}static fo(e,t){let n=ie(),s=ie();for(let i of t.docChanges)switch(i.type){case 0:n=n.add(i.doc.key);break;case 1:s=s.add(i.doc.key)}return new r(e,t.fromCache,n,s)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function FE(r,e){return Q.comparator(r.key,e.key)}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var uc=class{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var cc=class{constructor(){this.mo=!1,this.po=!1,this.yo=100,this.wo=(function(){return ch()?8:Qm(uh())>0?6:4})()}initialize(e,t){this.bo=e,this.indexManager=t,this.mo=!0}getDocumentsMatchingQuery(e,t,n,s){let i={result:null};return this.So(e,t).next((a=>{i.result=a})).next((()=>{if(!i.result)return this.vo(e,t,s,n).next((a=>{i.result=a}))})).next((()=>{if(i.result)return;let a=new uc;return this.Do(e,t,a).next((B=>{if(i.result=B,this.po)return this.xo(e,t,a,B.size)}))})).next((()=>i.result))}xo(e,t,n,s){return Se(t)?L.resolve():n.documentReadCount<this.yo?(Kn()<=se.DEBUG&&U("QueryEngine","SDK will not create cache indexes for query:",os(t),"since it only creates cache indexes for collection contains","more than or equal to",this.yo,"documents"),L.resolve()):(Kn()<=se.DEBUG&&U("QueryEngine","Query:",os(t),"scans",n.documentReadCount,"local documents and returns",s,"documents as results."),n.documentReadCount>this.wo*s?(Kn()<=se.DEBUG&&U("QueryEngine","The SDK decides to create cache indexes for query:",os(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,_t(t))):L.resolve())}So(e,t){if(Se(t))return L.resolve(null);let n=t;if(xf(n))return L.resolve(null);let s=_t(n);return this.indexManager.getIndexType(e,s).next((i=>i===0?null:(n.limit!==null&&i===1&&(n=Gi(n,null,"F"),s=_t(n)),this.indexManager.getDocumentsMatchingTarget(e,s).next((a=>{let B=ie(...a);return this.bo.getDocuments(e,B).next((u=>this.indexManager.getMinOffset(e,s).next((l=>{let f=this.Co(n,u);return this.Fo(n,f,B,l.readTime)?this.So(e,Gi(n,null,"F")):this.Oo(e,f,n,l)}))))})))))}vo(e,t,n,s){return(Se(t)?(function(a){for(let B of a.stages){if(B instanceof Pn||B instanceof oo)return!1;if(B instanceof vs){if(B.condition instanceof eo&&B.condition._expr.name==="exists"&&B.condition._expr.params[0]instanceof xn&&B.condition._expr.params[0].fieldName===ir)continue;return!1}}return!0})(t):xf(t))||s.isEqual(Z.min())?L.resolve(null):this.bo.getDocuments(e,n).next((i=>{let a=this.Co(t,i);return this.Fo(t,a,n,s)?L.resolve(null):(Kn()<=se.DEBUG&&U("QueryEngine","Re-using previous result from %s to execute query: %s",s.toString(),Jf(t)),this.Oo(e,a,t,hm(s,ms)).next((B=>B)))}))}Co(e,t){let n,s;return Se(e)?(n=new Re(FE),s=i=>Po(e,i)):(n=new Re(Pc(e)),s=i=>To(e,i)),t.forEach(((i,a)=>{s(a)&&(n=n.add(a))})),n}Fo(e,t,n,s){if(Se(e))return(function(B){return B.stages.some((u=>u instanceof Pn||u instanceof oo))})(e);if(e.limit===null)return!1;if(n.size!==t.size)return!0;let i=e.limitType==="F"?t.last():t.first();return!!i&&(i.hasPendingWrites||i.version.compareTo(s)>0)}Do(e,t,n){return Kn()<=se.DEBUG&&U("QueryEngine","Using full collection scan to execute query:",Jf(t)),this.bo.getDocumentsMatchingQuery(e,t,Fn.min(),n)}Oo(e,t,n,s){return this.bo.getDocumentsMatchingQuery(e,n,s).next((i=>(t.forEach((a=>{i=i.insert(a.key,a)})),i)))}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Hc="LocalStore",xE=3e8,lc=class{constructor(e,t,n,s){this.persistence=e,this.Mo=t,this.serializer=s,this.No=new _e(ne),this.Lo=new Lt((i=>nC(i)),rC),this.Bo=new Map,this.Uo=e.getRemoteDocumentCache(),this.A_=e.getTargetCache(),this.d_=e.getBundleCache(),this.ko(n)}ko(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new Xu(this.Uo,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.Uo.setIndexManager(this.indexManager),this.Mo.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(t=>e.collect(t,this.No)))}};function PE(r,e,t,n){return new lc(r,e,t,n)}async function EC(r,e){let t=Be(r);return await t.persistence.runTransaction("Handle user change","readonly",(n=>{let s;return t.mutationQueue.getAllMutationBatches(n).next((i=>(s=i,t.ko(e),t.mutationQueue.getAllMutationBatches(n)))).next((i=>{let a=[],B=[],u=ie();for(let l of s){a.push(l.batchId);for(let f of l.mutations)u=u.add(f.key)}for(let l of i){B.push(l.batchId);for(let f of l.mutations)u=u.add(f.key)}return t.localDocuments.getDocuments(n,u).next((l=>({qo:l,removedBatchIds:a,addedBatchIds:B})))}))}))}function _C(r){let e=Be(r);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(t=>e.A_.getLastRemoteSnapshotVersion(t)))}function OE(r,e){let t=Be(r),n=e.snapshotVersion,s=t.No;return t.persistence.runTransaction("Apply remote event","readwrite-primary",(i=>{let a=t.Uo.newChangeBuffer({trackRemovals:!0});s=t.No;let B=[];e.targetChanges.forEach(((f,C)=>{let D=s.get(C);if(!D)return;B.push(t.A_.removeMatchingKeys(i,f.removedDocuments,C).next((()=>t.A_.addMatchingKeys(i,f.addedDocuments,C))));let v=D.withSequenceNumber(i.currentSequenceNumber);e.targetMismatches.get(C)!==null?v=v.withResumeToken(Ae.EMPTY_BYTE_STRING,Z.min()).withLastLimboFreeSnapshotVersion(Z.min()):f.resumeToken.approximateByteSize()>0&&(v=v.withResumeToken(f.resumeToken,n)),s=s.insert(C,v),(function(V,H,z){return V.resumeToken.approximateByteSize()===0||H.snapshotVersion.toMicroseconds()-V.snapshotVersion.toMicroseconds()>=xE?!0:z.addedDocuments.size+z.modifiedDocuments.size+z.removedDocuments.size>0})(D,v,f)&&B.push(t.A_.updateTargetData(i,v))}));let u=rt(),l=ie();if(e.documentUpdates.forEach((f=>{e.resolvedLimboDocuments.has(f)&&B.push(t.persistence.referenceDelegate.updateLimboDocument(i,f))})),B.push(LE(i,a,e.documentUpdates).next((f=>{u=f.$o,l=f.Ko}))),!n.isEqual(Z.min())){let f=t.A_.getLastRemoteSnapshotVersion(i).next((C=>t.A_.setTargetsMetadata(i,i.currentSequenceNumber,n)));B.push(f)}return L.waitFor(B).next((()=>a.apply(i))).next((()=>t.localDocuments.getLocalViewOfDocuments(i,u,l))).next((()=>u))})).then((i=>(t.No=s,i)))}function LE(r,e,t){let n=ie(),s=ie();return t.forEach((i=>n=n.add(i))),e.getEntries(r,n).next((i=>{let a=rt();return t.forEach(((B,u)=>{let l=i.get(B);u.isFoundDocument()!==l.isFoundDocument()&&(s=s.add(B)),u.isNoDocument()&&u.version.isEqual(Z.min())?(e.removeEntry(B,u.readTime),a=a.insert(B,u)):!l.isValidDocument()||u.version.compareTo(l.version)>0||u.version.compareTo(l.version)===0&&l.hasPendingWrites?(e.addEntry(u),a=a.insert(B,u)):U(Hc,"Ignoring outdated watch update for ",B,". Current version:",l.version," Watch version:",u.version)})),{$o:a,Ko:s}}))}function VE(r,e){let t=Be(r);return t.persistence.runTransaction("Allocate target","readwrite",(n=>{let s;return t.A_.getTargetData(n,e).next((i=>i?(s=i,L.resolve(s)):t.A_.allocateTargetId(n).next((a=>(s=new wr(e,a,"TargetPurposeListen",n.currentSequenceNumber),t.A_.addTargetData(n,s).next((()=>s)))))))})).then((n=>{let s=t.No.get(n.targetId);return(s===null||n.snapshotVersion.compareTo(s.snapshotVersion)>0)&&(t.No=t.No.insert(n.targetId,n),t.Lo.set(e,n.targetId)),n}))}async function hc(r,e,t){let n=Be(r),s=n.No.get(e),i=t?"readwrite":"readwrite-primary";try{t||await n.persistence.runTransaction("Release target",i,(a=>n.persistence.referenceDelegate.removeTarget(a,s)))}catch(a){if(!Sr(a))throw a;U(Hc,`Failed to update sequence numbers for target ${e}: ${a}`)}n.No=n.No.remove(e),n.Lo.delete(s.target)}function zf(r,e,t){let n=Be(r),s=Z.min(),i=ie();return n.persistence.runTransaction("Execute query","readwrite",(a=>(function(u,l,f){let C=Be(u),D=C.Lo.get(f);return D!==void 0?L.resolve(C.No.get(D)):C.A_.getTargetData(l,f)})(n,a,Se(e)?e:_t(e)).next((B=>{if(B)return s=B.lastLimboFreeSnapshotVersion,n.A_.getMatchingKeysForTargetId(a,B.targetId).next((u=>{i=u}))})).next((()=>n.Mo.getDocumentsMatchingQuery(a,e,t?s:Z.min(),t?i:ie()))).next((B=>(kE(n,B),{documents:B,Qo:i})))))}function kE(r,e){e.forEach(((t,n)=>{let s=n.key.getCollectionGroup(),i=r.Bo.get(s)||Z.min();n.readTime.compareTo(i)>0&&r.Bo.set(s,n.readTime)}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var fc=class{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.Jo=0,this.Yo=null,this.Zo=!0}Xo(){this.Jo===0&&(this.ea("Unknown"),this.Yo=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this.Yo=null,this.ta("Backend didn't respond within 10 seconds."),this.ea("Offline"),Promise.resolve()))))}na(e){this.state==="Online"?this.ea("Unknown"):(this.Jo++,this.Jo>=1&&(this.ra(),this.ta(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ea("Offline")))}set(e){this.ra(),this.Jo=0,e==="Online"&&(this.Zo=!1),this.ea(e)}ea(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}ta(e){let t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.Zo?(xt(t),this.Zo=!1):U("OnlineStateTracker",t)}ra(){this.Yo!==null&&(this.Yo.cancel(),this.Yo=null)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Mt="RemoteStore",dc=class{constructor(e,t,n,s,i){this.localStore=e,this.datastore=t,this.asyncQueue=n,this.remoteSyncer={},this.ia=[],this.sa=new Map,this._a=new Map,this.oa=new Map,this.aa=new Ln(1e3),this.ua=new Ln(1001),this.ca=new Set,this.la=[],this.Ea=i,this.Ea.Ke((a=>{n.enqueueAndForget((async()=>{Ks(this)&&(U(Mt,"Restarting streams for network reachability change."),await(async function(u){let l=Be(u);l.ca.add(4),await Js(l),l.ha.set("Unknown"),l.ca.delete(4),await Oo(l)})(this))}))})),this.ha=new fc(n,s)}};async function Oo(r){if(Ks(r))for(let e of r.la)await e(!0)}async function Js(r){for(let e of r.la)await e(!1)}function Cc(r,e){return r._a.get(e)||void 0}function DC(r,e){let t=Be(r),n=Cc(t,e.targetId);if(n!==void 0&&t.sa.has(n))return;let s=(function(B,u){let l=Cc(B,u);l!==void 0&&B.oa.delete(l);let f=(function(D,v){return v%2!=0?D.ua.next():D.aa.next()})(B,u);return B._a.set(u,f),B.oa.set(f,u),f})(t,e.targetId);U(Mt,"remoteStoreListen mapping SDK target ID to remote",e.targetId,s);let i=new wr(e.target,s,e.purpose,e.sequenceNumber,e.snapshotVersion,e.lastLimboFreeSnapshotVersion,e.resumeToken);t.sa.set(s,i),Jc(t)?jc(t):Rr(t).Jt()&&qc(t,i)}function Uc(r,e){let t=Be(r),n=Rr(t),s=Cc(t,e);U(Mt,"remoteStoreUnlisten removing mapping of SDK target ID to remote",e,s),t.sa.delete(s),t._a.delete(e),t.oa.delete(s),n.Jt()&&yC(t,s),t.sa.size===0&&(n.Jt()?n.Xt():Ks(t)&&t.ha.set("Unknown"))}function qc(r,e){if(r.Ta.H(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(Z.min())>0){let t=r.oa.get(e.targetId);if(t===void 0)return void U(Mt,"SDK target ID not found for remote ID: "+e.targetId);let n=r.remoteSyncer.getRemoteKeysForTarget(t).size;e=e.withExpectedCount(n)}Rr(r).Tn(e)}function yC(r,e){r.Ta.H(e),Rr(r).Pn(e)}function jc(r){r.Ta=new cB({getRemoteKeysForTarget:e=>{let t=r.oa.get(e);return t!==void 0?r.remoteSyncer.getRemoteKeysForTarget(t):ie()},ge:e=>r.sa.get(e)||null,Ae:()=>r.datastore.serializer.databaseId}),Rr(r).start(),r.ha.Xo()}function Jc(r){return Ks(r)&&!Rr(r).Ht()&&r.sa.size>0}function Ks(r){return Be(r).ca.size===0}function wC(r){r.Ta=void 0}async function ME(r){r.ha.set("Online")}async function GE(r){r.sa.forEach(((e,t)=>{qc(r,e)}))}async function HE(r,e){wC(r),Jc(r)?(r.ha.na(e),jc(r)):r.ha.set("Unknown")}async function UE(r,e,t){if(r.ha.set("Online"),e instanceof Ui&&e.state===2&&e.cause)try{await(async function(s,i){let a=i.cause;for(let B of i.targetIds){if(s.sa.has(B)){let u=s.oa.get(B);u!==void 0&&(await s.remoteSyncer.rejectListen(u,a),s._a.delete(u),s.oa.delete(B)),s.sa.delete(B)}s.Ta.removeTarget(B)}})(r,e)}catch(n){U(Mt,"Failed to remove targets %s: %s ",e.targetIds.join(","),n),await Qf(r,n)}else if(e instanceof tr?r.Ta.se(e):e instanceof Hi?r.Ta.Ee(e):r.Ta.ae(e),!t.isEqual(Z.min()))try{let n=await _C(r.localStore);t.compareTo(n)>=0&&await(function(i,a){let B=i.Ta.de(a);B.targetChanges.forEach(((l,f)=>{if(l.resumeToken.approximateByteSize()>0){let C=i.sa.get(f);C&&i.sa.set(f,C.withResumeToken(l.resumeToken,a))}})),B.targetMismatches.forEach(((l,f)=>{let C=i.sa.get(l);if(!C)return;i.sa.set(l,C.withResumeToken(Ae.EMPTY_BYTE_STRING,C.snapshotVersion)),yC(i,l);let D=new wr(C.target,l,f,C.sequenceNumber);qc(i,D)}));let u=(function(f,C){let D=new Map;C.targetChanges.forEach(((R,V)=>{let H=f.oa.get(V);H!==void 0&&D.set(H,R)}));let v=new _e(ne);return C.targetMismatches.forEach(((R,V)=>{let H=f.oa.get(R);H!==void 0&&(v=v.insert(H,V))})),new Es(C.snapshotVersion,D,v,C.documentUpdates,C.augmentedDocumentUpdates,C.resolvedLimboDocuments)})(i,B);return i.remoteSyncer.applyRemoteEvent(u)})(r,t)}catch(n){U(Mt,"Failed to raise snapshot:",n),await Qf(r,n)}}async function Qf(r,e,t){if(!Sr(e))throw e;r.ca.add(1),await Js(r),r.ha.set("Offline"),t||(t=()=>_C(r.localStore)),r.asyncQueue.enqueueRetryable((async()=>{U(Mt,"Retrying IndexedDB access"),await t(),r.ca.delete(1),await Oo(r)}))}async function $f(r,e){let t=Be(r);t.asyncQueue.verifyOperationInProgress(),U(Mt,"RemoteStore received new credentials");let n=Ks(t);t.ca.add(3),await Js(t),n&&t.ha.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.ca.delete(3),await Oo(t)}async function qE(r,e){let t=Be(r);e?(t.ca.delete(2),await Oo(t)):e||(t.ca.add(2),await Js(t),t.ha.set("Unknown"))}function Rr(r){return r.Pa||(r.Pa=(function(t,n,s){let i=Be(t);return i.mn(),new yB(n,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(r.datastore,r.asyncQueue,{ut:ME.bind(null,r),lt:GE.bind(null,r),ht:HE.bind(null,r),hn:UE.bind(null,r)}),r.la.push((async e=>{e?(r.Pa.Zt(),Jc(r)?jc(r):r.ha.set("Unknown")):(await r.Pa.stop(),wC(r))}))),r.Pa}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var pc=class{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ia(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ia(this.observer.error,e):xt("Uncaught Error in snapshot listener:",e.toString()))}Aa(){this.muted=!0}Ia(e,t){setTimeout((()=>{this.muted||e(t)}),0)}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var gc=class r{constructor(e,t,n,s,i){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=n,this.op=s,this.removalCallback=i,this.deferred=new Xt,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((a=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,t,n,s,i){let a=Date.now()+n,B=new r(e,t,a,s,i);return B.start(n),B}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new j(M.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}};function IC(r,e){if(xt("AsyncQueue",`${e}: ${r}`),Sr(r))return new j(M.UNAVAILABLE,`${e}: ${r}`);throw r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var fo=class{constructor(){this.activeTargetIds=Im()}La(e){this.activeTargetIds=this.activeTargetIds.add(e)}Ba(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Na(){let e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}};var mc=class{constructor(){this.du=new fo,this.fu={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,n){}addLocalQueryTarget(e,t=!0){return t&&this.du.La(e),this.fu[e]||"not-current"}updateQueryState(e,t,n){this.fu[e]=t}removeLocalQueryTarget(e){this.du.Ba(e)}isLocalQueryTarget(e){return this.du.activeTargetIds.has(e)}clearQueryState(e){delete this.fu[e]}getAllActiveQueryTargets(){return this.du.activeTargetIds}isActiveQueryTarget(e){return this.du.activeTargetIds.has(e)}start(){return this.du=new fo,Promise.resolve()}handleUserChange(e,t,n){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function za(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ks=class r{static emptySet(e){return new r(e.comparator)}constructor(e){this.comparator=e?(t,n)=>e(t,n)||Q.comparator(t.key,n.key):(t,n)=>Q.comparator(t.key,n.key),this.keyedMap=Qn(),this.sortedSet=new _e(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){let t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((t,n)=>(e(t),!1)))}add(e){let t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){let t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof r)||this.size!==e.size)return!1;let t=this.sortedSet.getIterator(),n=e.sortedSet.getIterator();for(;t.hasNext();){let s=t.getNext().key,i=n.getNext().key;if(!s.isEqual(i))return!1}return!0}toString(){let e=[];return this.forEach((t=>{e.push(t.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){let n=new r;return n.comparator=this.comparator,n.keyedMap=e,n.sortedSet=t,n}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Co=class{constructor(){this.mu=new _e(Q.comparator)}track(e){let t=e.doc.key,n=this.mu.get(t);n?e.type!==0&&n.type===3?this.mu=this.mu.insert(t,e):e.type===3&&n.type!==1?this.mu=this.mu.insert(t,{type:n.type,doc:e.doc}):e.type===2&&n.type===2?this.mu=this.mu.insert(t,{type:2,doc:e.doc}):e.type===2&&n.type===0?this.mu=this.mu.insert(t,{type:0,doc:e.doc}):e.type===1&&n.type===0?this.mu=this.mu.remove(t):e.type===1&&n.type===2?this.mu=this.mu.insert(t,{type:1,doc:n.doc}):e.type===0&&n.type===1?this.mu=this.mu.insert(t,{type:2,doc:e.doc}):Y(63341,{ye:e,pu:n}):this.mu=this.mu.insert(t,e)}gu(){let e=[];return this.mu.inorderTraversal(((t,n)=>{e.push(n)})),e}},Ir=class r{constructor(e,t,n,s,i,a,B,u,l){this.query=e,this.docs=t,this.oldDocs=n,this.docChanges=s,this.mutatedKeys=i,this.fromCache=a,this.syncStateChanged=B,this.excludesMetadataChanges=u,this.hasCachedResults=l}static fromInitialDocuments(e,t,n,s,i){let a=[];return t.forEach((B=>{a.push({type:0,doc:B})})),new r(e,t,ks.emptySet(t),a,n,s,!0,!1,i)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&xo(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;let t=this.docChanges,n=e.docChanges;if(t.length!==n.length)return!1;for(let s=0;s<t.length;s++)if(t[s].type!==n[s].type||!t[s].doc.isEqual(n[s].doc))return!1;return!0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ec=class{constructor(){this.yu=void 0,this.wu=[]}bu(){return this.wu.some((e=>e.Su()))}},_c=class{constructor(){this.queries=Wf(),this.onlineState="Unknown",this.vu=new Set}terminate(){(function(t,n){let s=Be(t),i=s.queries;s.queries=Wf(),i.forEach(((a,B)=>{for(let u of B.wu)u.onError(n)}))})(this,new j(M.ABORTED,"Firestore shutting down"))}};function Wf(){return new Lt((r=>tC(r)),xo)}async function jE(r,e){let t=Be(r),n=3,s=e.query,i=t.queries.get(s);i?!i.bu()&&e.Su()&&(n=2):(i=new Ec,n=e.Su()?0:1);try{switch(n){case 0:i.yu=await t.onListen(s,!0);break;case 1:i.yu=await t.onListen(s,!1);break;case 2:await t.onFirstRemoteStoreListen(s)}}catch(a){let B=IC(a,`Initialization of query '${Se(e.query)?Ft(e.query):os(e.query)}' failed`);return void e.onError(B)}t.queries.set(s,i),i.wu.push(e),e.Du(t.onlineState),i.yu&&e.xu(i.yu)&&Kc(t)}async function JE(r,e){let t=Be(r),n=e.query,s=3,i=t.queries.get(n);if(i){let a=i.wu.indexOf(e);a>=0&&(i.wu.splice(a,1),i.wu.length===0?s=e.Su()?0:1:!i.bu()&&e.Su()&&(s=2))}switch(s){case 0:return t.queries.delete(n),t.onUnlisten(n,!0);case 1:return t.queries.delete(n),t.onUnlisten(n,!1);case 2:return t.onLastRemoteStoreUnlisten(n);default:return}}function KE(r,e){let t=Be(r),n=!1;for(let s of e){let i=s.query,a=t.queries.get(i);if(a){for(let B of a.wu)B.xu(s)&&(n=!0);a.yu=s}}n&&Kc(t)}function zE(r,e,t){let n=Be(r),s=n.queries.get(e);if(s)for(let i of s.wu)i.onError(t);n.queries.delete(e)}function Kc(r){r.vu.forEach((e=>{e.next()}))}var Dc;(function(r){r.Default="default",r.Cache="cache"})(Dc||(Dc={}));var yc=class{constructor(e,t,n){this.query=e,this.Cu=t,this.Fu=!1,this.Ou=null,this.onlineState="Unknown",this.options=n||{}}xu(e){if(!this.options.includeMetadataChanges){let n=[];for(let s of e.docChanges)s.type!==3&&n.push(s);e=new Ir(e.query,e.docs,e.oldDocs,n,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.Fu?this.Mu(e)&&(this.Cu.next(e),t=!0):this.Nu(e,this.onlineState)&&(this.Lu(e),t=!0),this.Ou=e,t}onError(e){this.Cu.error(e)}Du(e){this.onlineState=e;let t=!1;return this.Ou&&!this.Fu&&this.Nu(this.Ou,e)&&(this.Lu(this.Ou),t=!0),t}Nu(e,t){if(!e.fromCache||!this.Su())return!0;let n=t!=="Offline";return(!this.options.waitForSyncWhenOnline||!n)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}Mu(e){if(e.docChanges.length>0)return!0;let t=this.Ou&&this.Ou.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}Lu(e){e=Ir.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Fu=!0,this.Cu.next(e)}Su(){return this.options.source!==Dc.Cache}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var po=class{constructor(e){this.key=e}},go=class{constructor(e){this.key=e}},wc=class{constructor(e,t){this.query=e,this.Gu=t,this.zu=null,this.hasCachedResults=!1,this.current=!1,this.ju=ie(),this.mutatedKeys=ie(),this.Hu=Se(e)?$u(e):Pc(e),this.Ju=new ks(this.Hu)}get Yu(){return this.Gu}Zu(e,t){let n=t?t.Xu:new Co,s=t?t.Ju:this.Ju,i=t?t.mutatedKeys:this.mutatedKeys,a=s,B=!1,[u,l]=this.ec(this.query,s);e.inorderTraversal(((C,D)=>{let v=s.get(C),R=RE(this.query,D)?D:null,V=!!v&&this.mutatedKeys.has(v.key),H=!!R&&(R.hasLocalMutations||this.mutatedKeys.has(R.key)&&R.hasCommittedMutations),z=!1;v&&R?v.data.isEqual(R.data)?V!==H&&(n.track({type:3,doc:R}),z=!0):this.tc(v,R)||(n.track({type:2,doc:R}),z=!0,(u&&this.Hu(R,u)>0||l&&this.Hu(R,l)<0)&&(B=!0)):!v&&R?(n.track({type:0,doc:R}),z=!0):v&&!R&&(n.track({type:1,doc:v}),z=!0,(u||l)&&(B=!0)),z&&(R?(a=a.add(R),i=H?i.add(C):i.delete(C)):(a=a.delete(C),i=i.delete(C)))}));let f=this.nc(this.query);if(f)if(Se(this.query)){let C=[];a.forEach((R=>C.push(R)));let D=mC(this.query,C),v=new ks($u(this.query));for(let R of D)v=v.add(R);a.forEach((R=>{v.has(R.key)||(i=i.delete(R.key),n.track({type:1,doc:R}))})),a=v}else{let C=this.rc(this.query);for(;a.size>f;){let D=C==="F"?a.last():a.first();a=a.delete(D.key),i=i.delete(D.key),n.track({type:1,doc:D})}}return{Ju:a,Xu:n,Fo:B,mutatedKeys:i}}nc(e){return Se(e)?Ka(e)?.limit:e.limit||void 0}rc(e){if(Se(e)){let t=Ka(e);return t&&t.limit<0?"L":"F"}return e.limitType}ec(e,t){if(Se(e)){let n=Ka(e)?.limit;return[t.size===n?t.last():null,null]}return[e.limitType==="F"&&t.size===this.nc(this.query)?t.last():null,e.limitType==="L"&&t.size===this.nc(this.query)?t.first():null]}tc(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,n,s){let i=this.Ju;this.Ju=e.Ju,this.mutatedKeys=e.mutatedKeys;let a=e.Xu.gu();a.sort(((f,C)=>(function(v,R){let V=H=>{switch(H){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return Y(20277,{ye:H})}};return V(v)-V(R)})(f.type,C.type)||this.Hu(f.doc,C.doc))),this.sc(n),s=s??!1;let B=t&&!s?this._c():[],u=this.ju.size===0&&this.current&&!s?1:0,l=u!==this.zu;return this.zu=u,a.length!==0||l?{snapshot:new Ir(this.query,e.Ju,i,a,e.mutatedKeys,u===0,l,!1,!!n&&n.resumeToken.approximateByteSize()>0),oc:B}:{oc:B}}Du(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({Ju:this.Ju,Xu:new Co,mutatedKeys:this.mutatedKeys,Fo:!1},!1)):{oc:[]}}ac(e){return!this.Gu.has(e)&&!!this.Ju.has(e)&&!this.Ju.get(e).hasLocalMutations}sc(e){e&&(e.addedDocuments.forEach((t=>this.Gu=this.Gu.add(t))),e.modifiedDocuments.forEach((t=>{})),e.removedDocuments.forEach((t=>this.Gu=this.Gu.delete(t))),this.current=e.current)}_c(){if(!this.current)return[];let e=this.ju;this.ju=ie(),this.Ju.forEach((n=>{this.ac(n.key)&&(this.ju=this.ju.add(n.key))}));let t=[];return e.forEach((n=>{this.ju.has(n)||t.push(new go(n))})),this.ju.forEach((n=>{e.has(n)||t.push(new po(n))})),t}uc(e){this.Gu=e.Qo,this.ju=ie();let t=this.Zu(e.documents);return this.applyChanges(t,!0)}cc(){return Ir.fromInitialDocuments(this.query,this.Ju,this.mutatedKeys,this.zu===0,this.hasCachedResults)}},zc="SyncEngine",Ic=class{constructor(e,t,n){this.query=e,this.targetId=t,this.view=n}},Tc=class{constructor(e){this.key=e,this.lc=!1}},Ac=class{constructor(e,t,n,s,i,a){this.localStore=e,this.remoteStore=t,this.eventManager=n,this.sharedClientState=s,this.currentUser=i,this.maxConcurrentLimboResolutions=a,this.Ec={},this.hc=new Lt((B=>tC(B)),xo),this.Tc=new Map,this.Pc=new Set,this.Rc=new _e(Q.comparator),this.Ic=new Map,this.Ac=new Vs,this.Vc={},this.dc=new Map,this.fc=Ln.ws(),this.onlineState="Unknown",this.mc=void 0}get isPrimaryClient(){return this.mc===!0}};async function QE(r,e,t=!0){let n=SC(r),s,i=n.hc.get(e);return i?(n.sharedClientState.addLocalQueryTarget(i.targetId),s=i.view.cc()):s=await TC(n,e,t,!0),s}async function $E(r,e){let t=SC(r);await TC(t,e,!0,!1)}async function TC(r,e,t,n){let s=await VE(r.localStore,Se(e)?e:_t(e)),i=s.targetId,a=r.sharedClientState.addLocalQueryTarget(i,t),B;return n&&(B=await WE(r,e,i,a==="current",s.resumeToken)),r.isPrimaryClient&&t&&DC(r.remoteStore,s),B}async function WE(r,e,t,n,s){r.gc=(C,D,v)=>(async function(V,H,z,re){let ce=H.view.Zu(z);ce.Fo&&(ce=await zf(V.localStore,H.query,!1).then((({documents:I})=>H.view.Zu(I,ce))));let ee=re&&re.targetChanges.get(H.targetId),pe=re&&re.targetMismatches.get(H.targetId)!=null,me=H.view.applyChanges(ce,V.isPrimaryClient,ee,pe);return Xf(V,H.targetId,me.oc),me.snapshot})(r,C,D,v);let i=await zf(r.localStore,e,!0),a=new wc(e,i.Qo),B=a.Zu(i.documents),u=_s.createSynthesizedTargetChangeForCurrentChange(t,n&&r.onlineState!=="Offline",s),l=a.applyChanges(B,r.isPrimaryClient,u);Xf(r,t,l.oc);let f=new Ic(e,t,a);return r.hc.set(e,f),r.Tc.has(t)?r.Tc.get(t).push(e):r.Tc.set(t,[e]),l.snapshot}async function YE(r,e,t){let n=Be(r),s=n.hc.get(e),i=n.Tc.get(s.targetId);if(i.length>1)return n.Tc.set(s.targetId,i.filter((a=>!xo(a,e)))),void n.hc.delete(e);n.isPrimaryClient?(n.sharedClientState.removeLocalQueryTarget(s.targetId),n.sharedClientState.isActiveQueryTarget(s.targetId)||await hc(n.localStore,s.targetId,!1).then((()=>{n.sharedClientState.clearQueryState(s.targetId),t&&Uc(n.remoteStore,s.targetId),bc(n,s.targetId)})).catch(Ao)):(bc(n,s.targetId),await hc(n.localStore,s.targetId,!0))}async function XE(r,e){let t=Be(r),n=t.hc.get(e),s=t.Tc.get(n.targetId);t.isPrimaryClient&&s.length===1&&(t.sharedClientState.removeLocalQueryTarget(n.targetId),Uc(t.remoteStore,n.targetId))}async function AC(r,e){let t=Be(r);try{let n=await OE(t.localStore,e);e.targetChanges.forEach(((s,i)=>{let a=t.Ic.get(i);a&&($(s.addedDocuments.size+s.modifiedDocuments.size+s.removedDocuments.size<=1,22616),s.addedDocuments.size>0?a.lc=!0:s.modifiedDocuments.size>0?$(a.lc,14607):s.removedDocuments.size>0&&($(a.lc,42227),a.lc=!1))})),await vC(t,n,e)}catch(n){await Ao(n)}}function Yf(r,e,t){let n=Be(r);if(n.isPrimaryClient&&t===0||!n.isPrimaryClient&&t===1){let s=[];n.hc.forEach(((i,a)=>{let B=a.view.Du(e);B.snapshot&&s.push(B.snapshot)})),(function(a,B){let u=Be(a);u.onlineState=B;let l=!1;u.queries.forEach(((f,C)=>{for(let D of C.wu)D.Du(B)&&(l=!0)})),l&&Kc(u)})(n.eventManager,e),s.length&&n.Ec.hn(s),n.onlineState=e,n.isPrimaryClient&&n.sharedClientState.setOnlineState(e)}}async function ZE(r,e,t){let n=Be(r);n.sharedClientState.updateQueryState(e,"rejected",t);let s=n.Ic.get(e),i=s&&s.key;if(i){let a=new _e(Q.comparator);a=a.insert(i,dt.newNoDocument(i,Z.min()));let B=ie().add(i),u=new Es(Z.min(),new Map,new _e(ne),a,rt(),B);await AC(n,u),n.Rc=n.Rc.remove(i),n.Ic.delete(e),Qc(n)}else await hc(n.localStore,e,!1).then((()=>bc(n,e,t))).catch(Ao)}function bc(r,e,t=null){r.sharedClientState.removeLocalQueryTarget(e);for(let n of r.Tc.get(e))r.hc.delete(n),t&&r.Ec.yc(n,t);r.Tc.delete(e),r.isPrimaryClient&&r.Ac.Xs(e).forEach((n=>{r.Ac.containsKey(n)||bC(r,n)}))}function bC(r,e){r.Pc.delete(e.path.canonicalString());let t=r.Rc.get(e);t!==null&&(Uc(r.remoteStore,t),r.Rc=r.Rc.remove(e),r.Ic.delete(t),Qc(r))}function Xf(r,e,t){for(let n of t)n instanceof po?(r.Ac.addReference(n.key,e),e_(r,n)):n instanceof go?(U(zc,"Document no longer in limbo: "+n.key),r.Ac.removeReference(n.key,e),r.Ac.containsKey(n.key)||bC(r,n.key)):Y(19791,{wc:n})}function e_(r,e){let t=e.key,n=t.path.canonicalString();r.Rc.get(t)||r.Pc.has(n)||(U(zc,"New document in limbo: "+t),r.Pc.add(n),Qc(r))}function Qc(r){for(;r.Pc.size>0&&r.Rc.size<r.maxConcurrentLimboResolutions;){let e=r.Pc.values().next().value;r.Pc.delete(e);let t=new Q(le.fromString(e)),n=r.fc.next();r.Ic.set(n,new Tc(t)),r.Rc=r.Rc.insert(t,n),DC(r.remoteStore,new wr(_t(Io(t.path)),n,"TargetPurposeLimboResolution",mr.yn))}}async function vC(r,e,t){let n=Be(r),s=[],i=[],a=[];n.hc.isEmpty()||(n.hc.forEach(((B,u)=>{a.push(n.gc(u,e,t).then((l=>{if((l||t)&&n.isPrimaryClient){let f=l?!l.fromCache:t?.targetChanges.get(u.targetId)?.current;n.sharedClientState.updateQueryState(u.targetId,f?"current":"not-current")}if(l){s.push(l);let f=Bc.fo(u.targetId,l);i.push(f)}})))})),await Promise.all(a),n.Ec.hn(s),await(async function(u,l){let f=Be(u);try{await f.persistence.runTransaction("notifyLocalViewChanges","readwrite",(C=>L.forEach(l,(D=>L.forEach(D.Ao,(v=>f.persistence.referenceDelegate.addReference(C,D.targetId,v))).next((()=>L.forEach(D.Vo,(v=>f.persistence.referenceDelegate.removeReference(C,D.targetId,v)))))))))}catch(C){if(!Sr(C))throw C;U(Hc,"Failed to update sequence numbers: "+C)}for(let C of l){let D=C.targetId;if(!C.fromCache){let v=f.No.get(D),R=v.snapshotVersion,V=v.withLastLimboFreeSnapshotVersion(R);f.No=f.No.insert(D,V)}}})(n.localStore,i))}async function t_(r,e){let t=Be(r);if(!t.currentUser.isEqual(e)){U(zc,"User change. New user:",e.toKey());let n=await EC(t.localStore,e);t.currentUser=e,(function(i,a){i.dc.forEach((B=>{B.forEach((u=>{u.reject(new j(M.CANCELLED,a))}))})),i.dc.clear()})(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,n.removedBatchIds,n.addedBatchIds),await vC(t,n.qo)}}function n_(r,e){let t=Be(r),n=t.Ic.get(e);if(n&&n.lc)return ie().add(n.key);{let s=ie(),i=t.Tc.get(e);if(!i)return s;for(let a of i??[]){let B=t.hc.get(a);s=s.unionWith(B.view.Yu)}return s}}function SC(r){let e=Be(r);return e.remoteStore.remoteSyncer.applyRemoteEvent=AC.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=n_.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=ZE.bind(null,e),e.Ec.hn=KE.bind(null,e.eventManager),e.Ec.yc=zE.bind(null,e.eventManager),e}var Vn=class{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=Ud(e.databaseInfo.databaseId),this.sharedClientState=this.Sc(e),this.persistence=this.vc(e),await this.persistence.start(),this.localStore=this.Dc(e),this.gcScheduler=this.xc(e,this.localStore),this.indexBackfillerScheduler=this.Cc(e,this.localStore)}xc(e,t){return null}Cc(e,t){return null}Dc(e){return PE(this.persistence,new cc,e.initialUser,this.serializer)}vc(e){return new lo(ac.w_,this.serializer)}Sc(e){return new mc}async terminate(){this.gcScheduler?.stop(),this.indexBackfillerScheduler?.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}};Vn.provider={build:()=>new Vn};var mo=class extends Vn{constructor(e){super(),this.cacheSizeBytes=e}xc(e,t){$(this.persistence.referenceDelegate instanceof ho,46915);let n=this.persistence.referenceDelegate.garbageCollector;return new bB(n,e.asyncQueue,t)}vc(e){let t=this.cacheSizeBytes!==void 0?at.withCacheSize(this.cacheSizeBytes):at.DEFAULT;return new lo((n=>ho.w_(n,t)),this.serializer)}};var Tr=class{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=n=>Yf(this.syncEngine,n,1),this.remoteStore.remoteSyncer.handleCredentialChange=t_.bind(null,this.syncEngine),await qE(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new _c})()}createDatastore(e){let t=Ud(e.databaseInfo.databaseId),n=qm(e.databaseInfo);return jm(e.authCredentials,e.appCheckCredentials,n,t)}createRemoteStore(e){return(function(n,s,i,a,B){return new dc(n,s,i,a,B)})(this.localStore,this.datastore,e.asyncQueue,(t=>Yf(this.syncEngine,t,0)),(function(){return Wi.Je()?new Wi:new gB})())}createSyncEngine(e,t){return(function(s,i,a,B,u,l,f){let C=new Ac(s,i,a,B,u,l);return f&&(C.mc=!0),C})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){await(async function(t){let n=Be(t);U(Mt,"RemoteStore shutting down."),n.ca.add(5),await Js(n),n.Ea.shutdown(),n.ha.set("Unknown")})(this.remoteStore),this.datastore?.terminate(),this.eventManager?.terminate()}};Tr.provider={build:()=>new Tr};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Bn="FirestoreClient",vc=class{constructor(e,t,n,s,i){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=n,this._databaseInfo=s,this.user=xe.UNAUTHENTICATED,this.clientId=rr.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=i,this.authCredentials.start(n,(async a=>{U(Bn,"Received user=",a.uid),await this.authCredentialListener(a),this.user=a})),this.appCheckCredentials.start(n,(a=>(U(Bn,"Received new app check token=",a),this.appCheckCredentialListener(a,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();let e=new Xt;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){let n=IC(t,"Failed to shutdown persistence");e.reject(n)}})),e.promise}};async function Qa(r,e){r.asyncQueue.verifyOperationInProgress(),U(Bn,"Initializing OfflineComponentProvider");let t=r.configuration;await e.initialize(t);let n=t.initialUser;r.setCredentialChangeListener((async s=>{n.isEqual(s)||(await EC(e.localStore,s),n=s)})),e.persistence.setDatabaseDeletedListener((()=>r.terminate())),r._offlineComponents=e}async function Zf(r,e){r.asyncQueue.verifyOperationInProgress();let t=await r_(r);U(Bn,"Initializing OnlineComponentProvider"),await e.initialize(t,r.configuration),r.setCredentialChangeListener((n=>$f(e.remoteStore,n))),r.setAppCheckTokenChangeListener(((n,s)=>$f(e.remoteStore,s))),r._onlineComponents=e}async function r_(r){if(!r._offlineComponents)if(r._uninitializedComponentsProvider){U(Bn,"Using user provided OfflineComponentProvider");try{await Qa(r,r._uninitializedComponentsProvider._offline)}catch(e){let t=e;if(!(function(s){return s.name==="FirebaseError"?s.code===M.FAILED_PRECONDITION||s.code===M.UNIMPLEMENTED:!(typeof DOMException<"u"&&s instanceof DOMException)||s.code===22||s.code===20||s.code===11})(t))throw t;ut("Error using user provided cache. Falling back to memory cache: "+t),await Qa(r,new Vn)}}else U(Bn,"Using default OfflineComponentProvider"),await Qa(r,new mo(void 0));return r._offlineComponents}async function s_(r){return r._onlineComponents||(r._uninitializedComponentsProvider?(U(Bn,"Using user provided OnlineComponentProvider"),await Zf(r,r._uninitializedComponentsProvider._online)):(U(Bn,"Using default OnlineComponentProvider"),await Zf(r,new Tr))),r._onlineComponents}async function ed(r){let e=await s_(r),t=e.eventManager;return t.onListen=QE.bind(null,e.syncEngine),t.onUnlisten=YE.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=$E.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=XE.bind(null,e.syncEngine),t}function RC(r,e,t,n){let s=new pc(n),i=new yc(e,s,t);return r.asyncQueue.enqueueAndForget((async()=>jE(await ed(r),i))),()=>{s.Aa(),r.asyncQueue.enqueueAndForget((async()=>JE(await ed(r),i)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var $c=class{constructor(e,t,n,s,i){this._firestore=e,this._userDataWriter=t,this._key=n,this._document=s,this._converter=i}get id(){return this._key.path.lastSegment()}get ref(){return new Oe(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){let e=new i_(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){return this._document?.data.clone().value.mapValue.fields??void 0}get(e){if(this._document){let t=this._document.data.field(No("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}},i_=class extends $c{data(){return super.data()}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Eo=class{convertValue(e,t="none"){switch(be(e)){case 0:return null;case 1:return e.booleanValue;case 2:return Ce(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Ot(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw Y(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){let n={};return vr(e,((s,i)=>{n[s]=this.convertValue(i,t)})),n}convertVectorValue(e){let t=e.fields?.[Sn].arrayValue?.values?.map((n=>Ce(n.doubleValue)));return new st(t)}convertGeoPoint(e){return new Rt(Ce(e.latitude),Ce(e.longitude))}convertArray(e,t){return(e.values||[]).map((n=>this.convertValue(n,t)))}convertServerTimestamp(e,t){switch(t){case"previous":let n=js(e);return n==null?null:this.convertValue(n,t);case"estimate":return this.convertTimestamp(or(e));default:return null}}convertTimestamp(e){let t=Pt(e);return new Te(t.seconds,t.nanos)}convertDocumentKey(e,t){let n=le.fromString(e);$(Md(n),9688,{name:e});let s=new us(n.get(1),n.get(3)),i=new Q(n.popFirst(5));return s.isEqual(t)||xt(`A document reference to ${i} refers to a different database (${s.projectId}/${s.database}), which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),i}};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var td="AsyncQueue",_o=class{constructor(e=Promise.resolve()){this.qc=[],this.$c=!1,this.Kc=[],this.Qc=null,this.Wc=!1,this.Gc=!1,this.zc=[],this.jt=new Xi(this,"async_queue_retry"),this.jc=()=>{let n=za();n&&U(td,"Visibility state changed to "+n.visibilityState),this.jt.qt()},this.Hc=e;let t=za();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this.jc)}get isShuttingDown(){return this.$c}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.Jc(),this.Yc(e)}enterRestrictedMode(e){if(!this.$c){this.$c=!0,this.Gc=e||!1;let t=za();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this.jc)}}enqueue(e){if(this.Jc(),this.$c)return new Promise((()=>{}));let t=new Xt;return this.Yc((()=>this.$c&&this.Gc?Promise.resolve():(e().then(t.resolve,t.reject),t.promise))).then((()=>t.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.qc.push(e),this.Zc())))}async Zc(){if(this.qc.length!==0){try{await this.qc[0](),this.qc.shift(),this.jt.reset()}catch(e){if(!Sr(e))throw e;U(td,"Operation failed with retryable error: "+e)}this.qc.length>0&&this.jt.Ut((()=>this.Zc()))}}Yc(e){let t=this.Hc.then((()=>(this.Wc=!0,e().catch((n=>{throw this.Qc=n,this.Wc=!1,xt("INTERNAL UNHANDLED ERROR: ",nd(n)),n})).then((n=>(this.Wc=!1,n))))));return this.Hc=t,t}enqueueAfterDelay(e,t,n){this.Jc(),this.zc.indexOf(e)>-1&&(t=0);let s=gc.createAndSchedule(this,e,t,n,(i=>this.Xc(i)));return this.Kc.push(s),s}Jc(){this.Qc&&Y(47125,{el:nd(this.Qc)})}verifyOperationInProgress(){}async tl(){let e;do e=this.Hc,await e;while(e!==this.Hc)}nl(e){for(let t of this.Kc)if(t.timerId===e)return!0;return!1}rl(e){return this.tl().then((()=>{this.Kc.sort(((t,n)=>t.targetTimeMs-n.targetTimeMs));for(let t of this.Kc)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.tl()}))}il(e){this.zc.push(e)}Xc(e){let t=this.Kc.indexOf(e);this.Kc.splice(t,1)}};function nd(r){let e=r.message||"";return r.stack&&(e=r.stack.includes(r.message)?r.stack:r.message+`
`+r.stack),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ar=class extends bo{constructor(e,t,n,s){super(e,t,n,s),this.type="firestore",this._queue=new _o,this._persistenceKey=s?.name||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){let e=this._firestoreClient.terminate();this._queue=new _o(e),this._firestoreClient=void 0,await e}}};function Wc(r,e){let t=typeof r=="object"?r:vh(),n=typeof r=="string"?r:e||Oi,s=Ia(t,"firestore").getImmediate({identifier:n});if(!s._initialized){let i=ah("firestore");i&&vo(s,...i)}return s}function NC(r){if(r._terminated)throw new j(M.FAILED_PRECONDITION,"The client has already been terminated.");return r._firestoreClient||o_(r),r._firestoreClient}function o_(r){let e=r._freezeSettings(),t=Km(r._databaseId,r._app?.options.appId||"",r._persistenceKey,r._app?.options.apiKey,e);r._componentsProvider||e.localCache?._offlineComponentProvider&&e.localCache?._onlineComponentProvider&&(r._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),r._firestoreClient=new vc(r._authCredentials,r._appCheckCredentials,r._queue,t,r._componentsProvider&&(function(s){let i=s?._online.build();return{_offline:s?._offline.build(i),_online:i}})(r._componentsProvider))}function Yc(r){return Th(r.app,"firestore",r._databaseId.database),r._delete()}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Ms=class extends Eo{constructor(e){super(),this.firestore=e}convertBytes(e){return new St(e)}convertReference(e){let t=this.convertDocumentKey(e,this.firestore._databaseId);return new Oe(this.firestore,null,t)}};/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Yt=class{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}},tn=class r extends $c{constructor(e,t,n,s,i,a){super(e,t,n,s,a),this._firestore=e,this._firestoreImpl=e,this.metadata=i}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){let t=new An(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){let n=this._document.data.field(No("DocumentSnapshot.get",e));if(n!==null)return this._userDataWriter.convertValue(n,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new j(M.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");let e=this._document,t={};return t.type=r._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}};tn._jsonSchemaVersion="firestore/documentSnapshot/1.0",tn._jsonSchema={type:Ie("string",tn._jsonSchemaVersion),bundleSource:Ie("string","DocumentSnapshot"),bundleName:Ie("string"),bundle:Ie("string")};var An=class extends tn{data(e={}){return super.data(e)}},bn=class r{constructor(e,t,n,s){this._firestore=e,this._userDataWriter=t,this._snapshot=s,this.metadata=new Yt(s.hasPendingWrites,s.fromCache),this.query=n}get docs(){let e=[];return this.forEach((t=>e.push(t))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach((n=>{e.call(t,new An(this._firestore,this._userDataWriter,n.key,n,new Yt(this._snapshot.mutatedKeys.has(n.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){let t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new j(M.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=(function(s,i){if(s._snapshot.oldDocs.isEmpty()){let a=0;return s._snapshot.docChanges.map((B=>{Se(s._snapshot.query)?$u(s._snapshot.query):Pc(s.query._query);let u=new An(s._firestore,s._userDataWriter,B.doc.key,B.doc,new Yt(s._snapshot.mutatedKeys.has(B.doc.key),s._snapshot.fromCache),s.query.converter);return B.doc,{type:"added",doc:u,oldIndex:-1,newIndex:a++}}))}{let a=s._snapshot.oldDocs;return s._snapshot.docChanges.filter((B=>i||B.type!==3)).map((B=>{let u=new An(s._firestore,s._userDataWriter,B.doc.key,B.doc,new Yt(s._snapshot.mutatedKeys.has(B.doc.key),s._snapshot.fromCache),s.query.converter),l=-1,f=-1;return B.type!==0&&(l=a.indexOf(B.doc.key),a=a.delete(B.doc.key)),B.type!==1&&(a=a.add(B.doc),f=a.indexOf(B.doc.key)),{type:a_(B.type),doc:u,oldIndex:l,newIndex:f}}))}})(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new j(M.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");let e={};e.type=r._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=rr.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;let t=[],n=[],s=[];return this.docs.forEach((i=>{i._document!==null&&(t.push(i._document),n.push(this._userDataWriter.convertObjectMap(i._document.data.value.mapValue.fields,"previous")),s.push(i.ref.path))})),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}};function a_(r){switch(r){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return Y(61501,{type:r})}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */bn._jsonSchemaVersion="firestore/querySnapshot/1.0",bn._jsonSchema={type:Ie("string",bn._jsonSchemaVersion),bundleSource:Ie("string","QuerySnapshot"),bundleName:Ie("string"),bundle:Ie("string")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function B_(r){if(r.limitType==="L"&&r.explicitOrderBy.length===0)throw new j(M.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function FC(r){return(function(t,n){if(typeof t!="object"||t===null)return!1;let s=t;for(let i of n)if(i in s&&typeof s[i]=="function")return!0;return!1})(r,["next","error","complete"])}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zs(r,...e){r=Kt(r);let t={includeMetadataChanges:!1,source:"default"},n=0;typeof e[n]!="object"||FC(e[n])||(t=e[n++]);let s={includeMetadataChanges:t.includeMetadataChanges,source:t.source};if(FC(e[n])){let l=e[n];e[n]=l.next?.bind(l),e[n+1]=l.error?.bind(l),e[n+2]=l.complete?.bind(l)}let i,a,B;if(r instanceof Oe)a=Hs(r.firestore,Ar),B=Io(r._key.path),i={next:l=>{e[n]&&e[n](u_(a,r,l))},error:e[n+1],complete:e[n+2]};else{let l=Hs(r,ws);a=Hs(l.firestore,Ar),B=l._query;let f=new Ms(a);i={next:C=>{e[n]&&e[n](new bn(a,f,l,C))},error:e[n+1],complete:e[n+2]},B_(r._query)}let u=NC(a);return RC(u,B,s,i)}function u_(r,e,t){let n=t.docs.get(e._key),s=new Ms(r);return new tn(r,s,e._key,n,new Yt(t.hasPendingWrites,t.fromCache),e.converter)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var xC="@firebase/firestore",PC="4.17.1";(function(e,t=!0){rd(bh),$r(new wt("firestore",((n,{instanceIdentifier:s,options:i})=>{let a=n.getProvider("app").getImmediate(),B=new Ar(new zi(n.getProvider("auth-internal")),new $i(a,n.getProvider("app-check-internal")),fd(a,s),a);return i={useFetchStreams:t,...i},B._setSettings(i),B}),"PUBLIC").setMultipleInstances(!0)),zt(xC,PC,e),zt(xC,PC,"esm2020")})();var c_="c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b",l_={nao_informada:"N\xE3o informada",disponivel:"Dispon\xEDvel",reservada:"Reservada",vendida:"Vendida",bloqueada:"Bloqueada"},OC=()=>({priceCents:null,areaM2:null,bedrooms:null,bathrooms:null,parking:null,description:null,conditions:null}),LC=(r,e)=>`p${String(r).padStart(2,"0")}-f${String(e).padStart(2,"0")}`,VC=(r,e)=>`liv-ipanema/pavimento-modelo-${String(r).padStart(2,"0")}/final-${String(e).padStart(2,"0")}`;function h_(){return Array.from({length:170},(r,e)=>{let t=Math.floor(e/10),n=e%10+1;return{id:LC(t,n),floor:t,final:n,technicalId:VC(t,n)}})}function $s(r){if(!r||typeof r!="object"||Array.isArray(r))throw Error("Cadastro inv\xE1lido.");return r}function Qs(r,e){if(r===null)return null;if(typeof r!="string"||!r.trim()||r.length>e)throw Error("Texto do cadastro inv\xE1lido.");return r.trim()}function Xc(r){let e=$s(r),t=OC();if(Object.keys(e).length!==7||Object.keys(e).some(s=>!Object.hasOwn(t,s)))throw Error("Campos da ficha inv\xE1lidos.");let n=(s,i,a)=>{let B=e[s];if(B===null)return null;if(typeof B!="number"||!Number.isFinite(B)||B<0||B>i||a&&!Number.isSafeInteger(B))throw Error(`Valor inv\xE1lido: ${s}.`);return B};return{priceCents:n("priceCents",Number.MAX_SAFE_INTEGER,!0),areaM2:n("areaM2",1e4,!1),bedrooms:n("bedrooms",100,!0),bathrooms:n("bathrooms",100,!0),parking:Qs(e.parking,200),description:Qs(e.description,2e3),conditions:Qs(e.conditions,2e3)}}function f_(r){let e=$s(r),t=e.floor,n=e.final;if(!Number.isInteger(t)||t<0||t>16||!Number.isInteger(n)||n<1||n>10||e.id!==LC(t,n)||e.technicalId!==VC(t,n)||typeof e.availability!="string"||!Object.hasOwn(l_,e.availability)||e.profileId!==null&&!["canto","meio"].includes(e.profileId))throw Error("Posi\xE7\xE3o, planta ou disponibilidade inv\xE1lida.");let s=Qs(e.commercialNumber,100)?.normalize("NFKC").toLocaleUpperCase("pt-BR")??null;if(s!==null&&!/^[A-Z0-9 _-]{1,100}$/.test(s))throw Error("Use letras, n\xFAmeros, espa\xE7o ou h\xEDfen no n\xFAmero comercial (ex.: TORRE A-101).");return{...e,commercialNumber:s,overrides:Xc(e.overrides)}}function Zc(r){let e=$s(r);if(e.schema!=="liv-sales-v1"||e.model!=="liv-ipanema"||e.bookSHA256!==c_||e.total!==170||typeof e.publicEnabled!="boolean"||!Number.isSafeInteger(e.revision)||e.revision<1||!Qs(e.title,200))throw Error("Estoque de outra revis\xE3o.");return e}function d_(r,e){let t=e.find(n=>n.id===r.profileId)?.info??OC();return Object.fromEntries(Object.keys(t).map(n=>[n,r.overrides[n]??t[n]]))}function kC(r){if(r.length!==170||new Set(r.map(t=>f_(t).id)).size!==170)throw Error("O cadastro precisa conter as 170 posi\xE7\xF5es, sem duplicatas.");let e=r.map(t=>t.commercialNumber?.normalize("NFKC").toLocaleUpperCase("pt-BR")).filter(Boolean);if(new Set(e).size!==e.length)throw Error("N\xFAmero comercial repetido. Confira o cadastro.");return r}var C_=175,p_=4;function MC(r){let e=$s($s(r).spaces),t=new Set(h_().map(s=>s.id)),n=new Map;for(let[s,i]of Object.entries(e)){if(!/^[1-9]\d{0,2}$/.test(s)||Number(s)>C_||typeof i!="string"||!t.has(i))throw Error("Mapa de vagas inv\xE1lido.");n.set(i,(n.get(i)??0)+1)}if([...n.values()].some(s=>s>p_))throw Error("Mapa de vagas inv\xE1lido.");return e}function ow(r,e="",t=""){let n=r;if(n?.schema!=="liv-sales-config-v1"||!["firebase","emulador","desativado"].includes(n.mode??""))throw Error("Configura\xE7\xE3o do estoque inv\xE1lida.");let s=new URLSearchParams(e).get("estoque")??n.propertyId;if(n.mode==="desativado"||!s)return null;if(!/^[A-Za-z0-9_-]{1,128}$/.test(s)||!n.firebase?.apiKey||!/^[a-z][a-z0-9-]{4,62}$/.test(n.firebase.projectId??""))throw Error("Identificador do estoque inv\xE1lido.");if(n.mode==="emulador"&&(!["localhost","127.0.0.1","[::1]"].includes(t)||n.firebase.projectId!=="demo-painel"||!Number.isInteger(n.emulatorPort)||n.emulatorPort<1024||n.emulatorPort>65535))throw Error("Emulador permitido somente em teste local.");if(n.mode==="firebase"&&n.firebase.projectId?.startsWith("demo-"))throw Error("Projeto de teste n\xE3o pode usar produ\xE7\xE3o.");return{id:s,mode:n.mode,options:n.firebase,emulatorPort:n.emulatorPort}}function g_(r,e,t,n={spaces:{}}){let s=Zc(r);if(kC(e),t.length!==2||new Set(t.map(B=>B.id)).size!==2||t.some(B=>!["canto","meio"].includes(B.id)))throw Error("Faltam as duas plantas do cadastro.");let i=t.map(B=>({...B,info:Xc(B.info)})),a={};try{a=MC(n)}catch{}return{settings:s,units:e,profiles:i,parking:a}}function aw(r,e,t){let n=Ta(r.options,`liv-stock-${r.id}-${Math.random().toString(36).slice(2)}`),s=Wc(n);r.mode==="emulador"&&vo(s,"127.0.0.1",r.emulatorPort);let i=!1,a="",B=[],u=null,l=null,f=null,C=null,D={settings:!1,units:!1,profiles:!1,parking:!1},v=ce=>{if(i)return;let ee=ce.code==="permission-denied";ee&&(a="",e(null)),t(ee?"Consulta de disponibilidade desabilitada ou sem permiss\xE3o.":"N\xE3o foi poss\xEDvel atualizar a disponibilidade. Confirme com a equipe respons\xE1vel.",ee)};function R(){if(!(i||!u?.publicEnabled||!l||!f||!C)){if(!Object.values(D).every(Boolean)){t("Sem confirma\xE7\xE3o atual do servidor. Disponibilidade sujeita a confirma\xE7\xE3o.");return}try{let ce=g_(u,l,f,C),ee=JSON.stringify([u.revision,l.map(pe=>[pe.id,pe.revision]),f.map(pe=>[pe.id,pe.revision]),C.revision??0]);ee!==a&&(a=ee,e(ce)),t("")}catch{t("Cadastro incompleto ou inconsistente. Confirme a disponibilidade com a equipe respons\xE1vel.")}}}let V=Ro(s,"salesInventory",r.id);function H(){B.forEach(ce=>ce()),B=[],l=null,f=null,C=null,D.units=!1,D.profiles=!1,D.parking=!1}let z=zs(V,{includeMetadataChanges:!0},ce=>{if(!i){try{u=ce.exists()?Zc(ce.data()):null}catch{v({});return}if(D.settings=!ce.metadata.fromCache&&!ce.metadata.hasPendingWrites,!u?.publicEnabled){H(),a="",e(null),t("Disponibilidade ainda n\xE3o publicada pelo respons\xE1vel.");return}B.length||(B.push(zs(So(V,"units"),{includeMetadataChanges:!0},ee=>{l=ee.docs.map(pe=>({...pe.data(),id:pe.id})),D.units=!ee.metadata.fromCache&&!ee.metadata.hasPendingWrites,R()},v)),B.push(zs(So(V,"profiles"),{includeMetadataChanges:!0},ee=>{f=ee.docs.map(pe=>({...pe.data(),id:pe.id})),D.profiles=!ee.metadata.fromCache&&!ee.metadata.hasPendingWrites,R()},v)),B.push(zs(Ro(V,"parking","mapa"),{includeMetadataChanges:!0},ee=>{C=ee.exists()?ee.data():{spaces:{}},D.parking=!ee.metadata.fromCache&&!ee.metadata.hasPendingWrites,R()},()=>{i||(C={spaces:{}},D.parking=!0,R())}))),R()}},v),re=()=>{i||(navigator.onLine?R():t("Sem conex\xE3o. A disponibilidade exibida pode estar desatualizada."))};return window.addEventListener("offline",re),window.addEventListener("online",re),async()=>{i||(i=!0,z(),H(),window.removeEventListener("offline",re),window.removeEventListener("online",re),await Yc(s),await Sh(n))}}export{aw as assinarEstoque,d_ as resolverInformacoes,ow as validarConfig,g_ as validarSnapshot};
