// Read-only measurements for a controlled dealer capture. Detection output is
// evidence for review, never automatic approval or invented missing tracking.
// Usage: swift inspect-contact-capture.swift frames-directory output.json
import Foundation
import Vision
import CoreImage

func paperFraction(_ corners:[CGPoint],_ pixels:[UInt8],_ w:Int,_ h:Int) -> Double {
    var light=0
    for v in 1...9 { for u in 1...9 {
        let a=CGFloat(u)/10,b=CGFloat(v)/10
        let topX=corners[0].x*(1-a)+corners[1].x*a
        let topY=corners[0].y*(1-a)+corners[1].y*a
        let bottomX=corners[3].x*(1-a)+corners[2].x*a
        let bottomY=corners[3].y*(1-a)+corners[2].y*a
        let x=min(w-1,max(0,Int((topX*(1-b)+bottomX*b)*CGFloat(w))))
        let y=min(h-1,max(0,Int((1-(topY*(1-b)+bottomY*b))*CGFloat(h))))
        let offset=(y*w+x)*4
        let r=Int(pixels[offset]),g=Int(pixels[offset+1]),bl=Int(pixels[offset+2])
        if r>190 && g>180 && bl>140 && abs(r-g)<30 && abs(g-bl)<60 {light += 1}
    }}
    return Double(light)/81
}

guard CommandLine.arguments.count == 3 else { fatalError("frames-directory output.json required") }
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let files=try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil)
    .filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent<$1.lastPathComponent}
guard let first=files.first, let reference=CIImage(contentsOf:first) else {fatalError("No source frames")}
var output:[[String:Any]]=[]
let context=CIContext()
for (i,file) in files.enumerated() { autoreleasepool {
    guard let image=CIImage(contentsOf:file) else{return}
    let hands=VNDetectHumanHandPoseRequest();hands.maximumHandCount=2
    let rectangles=VNDetectRectanglesRequest();rectangles.minimumConfidence=0.25
    rectangles.minimumSize=0.015;rectangles.maximumObservations=20
    rectangles.minimumAspectRatio=0.25;rectangles.maximumAspectRatio=1
    rectangles.quadratureTolerance=35
    rectangles.regionOfInterest=CGRect(x:0.44,y:0.20,width:0.25,height:0.28)
    try? VNImageRequestHandler(ciImage:image).perform([hands,rectangles])
    var detectedHands:[[String:Any]]=[]
    for hand in hands.results ?? [] {
        guard let points=try? hand.recognizedPoints(.all) else {continue}
        var detected:[String:[Double]]=[:]
        for (name,point) in points {
            detected[name.rawValue.rawValue]=[Double(point.location.x),1-Double(point.location.y),Double(point.confidence)]
        }
        detectedHands.append(["points":detected])
    }
    let w=Int(image.extent.width),h=Int(image.extent.height)
    var pixels=[UInt8](repeating:0,count:w*h*4)
    context.render(image,toBitmap:&pixels,rowBytes:w*4,bounds:image.extent,format:.RGBA8,colorSpace:CGColorSpaceCreateDeviceRGB())
    var quads:[[String:Any]]=[]
    for rect in rectangles.results ?? [] {
        let corners:[CGPoint]=[rect.topLeft,rect.topRight,rect.bottomRight,rect.bottomLeft]
        let fraction=paperFraction(corners,pixels,w,h)
        let coords:[[Double]]=corners.map{[Double($0.x),1-Double($0.y)]}
        quads.append(["confidence":Double(rect.confidence),"paperFraction":fraction,"corners":coords])
    }
    // A background-only crop excludes Astrid and the moving table props.
    let area=CGRect(x:0,y:image.extent.height*0.62,width:image.extent.width*0.30,height:image.extent.height*0.36)
    let registration=VNTranslationalImageRegistrationRequest(targetedCIImage:reference.cropped(to:area))
    try? VNImageRequestHandler(ciImage:image.cropped(to:area)).perform([registration])
    var shift:[Double]=[]
    if let result=registration.results?.first as? VNImageTranslationAlignmentObservation {
        shift=[Double(result.alignmentTransform.tx),Double(result.alignmentTransform.ty)]
    }
    output.append(["frame":i,"file":file.lastPathComponent,"hands":detectedHands,"rectangles":quads,"backgroundShiftPixels":shift])
}}
let data=try JSONSerialization.data(withJSONObject:output,options:[.sortedKeys])
try data.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
print("Measured \(output.count) frames; detections require visual review.")
