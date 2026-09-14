import Foundation
import AVFoundation
import Vision
import CoreImage
let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]); let dir = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
let asset = AVURLAsset(url: input)
guard let track = asset.tracks(withMediaType: .video).first else { fatalError("missing track") }
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
output.alwaysCopiesSampleData = false; reader.add(output)
guard reader.startReading() else { fatalError("reader start") }
let ctx = CIContext(); var n=0; var rows:[[String:Any]]=[]
while let sample = output.copyNextSampleBuffer() {
 autoreleasepool {
  guard let pixel = CMSampleBufferGetImageBuffer(sample) else { fatalError("missing pixelbuffer") }
  let req = VNGeneratePersonSegmentationRequest(); req.qualityLevel = .accurate; req.outputPixelFormat=kCVPixelFormatType_OneComponent8
  do {
   try VNImageRequestHandler(cvPixelBuffer: pixel).perform([req])
   guard let mask=req.results?.first?.pixelBuffer else { fatalError("missing mask") }
   var img=CIImage(cvPixelBuffer:mask); img=img.transformed(by:CGAffineTransform(scaleX:CGFloat(CVPixelBufferGetWidth(pixel))/img.extent.width,y:CGFloat(CVPixelBufferGetHeight(pixel))/img.extent.height))
   let name=String(format:"%04d.png",n)
   try ctx.writePNGRepresentation(of:img,to:dir.appendingPathComponent(name),format:.L8,colorSpace:CGColorSpaceCreateDeviceGray())
   rows.append(["native":n,"pts":CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)),"file":name,"width":CVPixelBufferGetWidth(pixel),"height":CVPixelBufferGetHeight(pixel)])
  } catch { fatalError("segmentation failed \(n): \(error)") }
 }
 n += 1; if n%24 == 0 { print("masks \(n)") }
}
guard reader.status == .completed else { fatalError("reader incomplete \(String(describing:reader.error))") }
let data=try JSONSerialization.data(withJSONObject:["status":"raw Vision person masks, not cleaned actor/finger acceptance","frames":rows],options:[.prettyPrinted,.sortedKeys]);try data.write(to:dir.appendingPathComponent("timestamps.json"));print("complete \(n)")
