import Foundation
import Vision
import CoreImage
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let files=try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent<$1.lastPathComponent}
var result:[[String:Any]]=[]
for file in files { autoreleasepool {
 guard let image=CIImage(contentsOf:file) else{return}
 let request=VNDetectFaceRectanglesRequest()
 try? VNImageRequestHandler(ciImage:image).perform([request])
 guard let face=request.results?.max(by:{$0.boundingBox.width<$1.boundingBox.width}) else{return}
 let b=face.boundingBox
 result.append(["file":file.lastPathComponent,"confidence":face.confidence,"bounds":[b.minX,1-b.maxY,b.width,b.height]])
}}
try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys]).write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
