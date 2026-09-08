import Foundation
import Vision
import CoreImage
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let files=try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent<$1.lastPathComponent}
var frames:[[String:Any]]=[]
for (i,file) in files.enumerated(){ autoreleasepool {
 guard let image=CIImage(contentsOf:file) else{return}
 let req=VNDetectHumanHandPoseRequest();req.maximumHandCount=2
 try? VNImageRequestHandler(ciImage:image).perform([req])
 var hands:[[String:Any]]=[]
 for h in req.results ?? [] {
  guard let ps=try? h.recognizedPoints(.all) else{continue}
  var pts:[String:[Double]]=[:]
  for (k,p) in ps where p.confidence > 0.25 {pts[k.rawValue.rawValue]=[Double(p.location.x),1-Double(p.location.y),Double(p.confidence)]}
  hands.append(["points":pts])
 }
 frames.append(["frame":i,"hands":hands])
}}
let data=try JSONSerialization.data(withJSONObject:frames,options:[.sortedKeys]);try data.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
