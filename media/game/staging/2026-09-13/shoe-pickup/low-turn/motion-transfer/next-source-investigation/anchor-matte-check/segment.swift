import Foundation
import Vision
import CoreImage
import ImageIO
let source=URL(fileURLWithPath:CommandLine.arguments[1]),out=URL(fileURLWithPath:CommandLine.arguments[2])
let original=CIImage(contentsOf:source)!
let request=VNGeneratePersonSegmentationRequest();request.qualityLevel = .accurate;request.outputPixelFormat=kCVPixelFormatType_OneComponent8
try VNImageRequestHandler(url:source).perform([request])
guard let pixel=request.results?.first?.pixelBuffer else {fatalError("No person mask")}
var mask=CIImage(cvPixelBuffer:pixel);mask=mask.transformed(by:CGAffineTransform(scaleX:original.extent.width/mask.extent.width,y:original.extent.height/mask.extent.height))
try CIContext().writePNGRepresentation(of:mask,to:out,format:.L8,colorSpace:CGColorSpaceCreateDeviceGray())
print("mask \(original.extent.width)x\(original.extent.height)")
