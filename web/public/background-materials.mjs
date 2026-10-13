// Original background pairs supplied by Jakob, 13 October 2026.
// A material ID identifies one environment, never an operator-owned room.
// Each image/video stays an immutable file with its own upload UUID and hash.
// These entries do not create rooms, grant access or approve/publish media.
export const BACKGROUND_MATERIALS = Object.freeze([
  Object.freeze({id:'studio-dark',role:'background',game:null,label:'Studio · mörk',sources:Object.freeze([
    Object.freeze({kind:'image',contentType:'image/png',sha256:'d617b95224d3e2c3dcf8ebf9f23ed6c20c5832e737d5ebee5d997e3366f7294f',size:2437940,width:1672,height:941}),
    Object.freeze({kind:'video',contentType:'video/mp4',sha256:'ed42e848c177fc3ee6ff6451895efa0a8e6fa79c51abc8751e08639c2a6f39a3',size:3482562,width:1920,height:1080}),
  ])}),
  Object.freeze({id:'lounge-warm',role:'background',game:null,label:'Lounge · varm',sources:Object.freeze([
    Object.freeze({kind:'image',contentType:'image/png',sha256:'4ae87731157e4958c894cb222f7e844d9008654eb233ef03c81397feefbb5a6e',size:2141210,width:1672,height:941}),
    Object.freeze({kind:'video',contentType:'video/mp4',sha256:'09b3dde6ae08d1f2b21e3a003786191ba871ae0d53f8bf91fffefdf62d0c3c3b',size:4383024,width:1920,height:1080}),
  ])}),
  Object.freeze({id:'studio-teal',role:'background',game:null,label:'Studio · turkos',sources:Object.freeze([
    Object.freeze({kind:'image',contentType:'image/png',sha256:'d8219b625ed8f6d5baf7fe5741b1c0460989874b93b2bb6b243435eb6a894526',size:1913808,width:1672,height:941}),
    Object.freeze({kind:'video',contentType:'video/mp4',sha256:'eb940994ce7f716e39d1e426923fb902b5fe7f398ea2aed693eff775418402e3',size:3369337,width:1920,height:1080}),
  ])}),
]);
