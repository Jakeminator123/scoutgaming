"""Preserve explicit native color multipliers unsupported by the Blender exporter node path."""
import json,struct
from pathlib import Path

def set_material_factor(path,name,factor):
 path=Path(path);raw=path.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
 if magic!=0x46546c67 or version!=2 or length!=len(raw):raise ValueError('Invalid GLB header')
 chunks=[];offset=12
 while offset<len(raw):
  size,kind=struct.unpack_from('<II',raw,offset);chunks.append((kind,raw[offset+8:offset+8+size]));offset+=8+size
 document=json.loads(chunks[0][1]);matches=[m for m in document.get('materials',[]) if m.get('name')==name]
 if len(matches)!=1:raise ValueError('Expected one material '+name)
 matches[0].setdefault('pbrMetallicRoughness',{})['baseColorFactor']=factor
 encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);chunks[0]=(chunks[0][0],encoded)
 payload=b''.join(struct.pack('<II',len(data),kind)+data for kind,data in chunks);path.write_bytes(struct.pack('<III',magic,version,12+len(payload))+payload)
