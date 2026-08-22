// Person-segmentation masks for dealer clips (locked camera, static room).
// Usage: person-mask <frames-dir> <masks-dir>
// Reads every .png in frames-dir, writes a grayscale person mask png per frame.
import Foundation
import Vision
import CoreImage
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3 else { FileHandle.standardError.write("usage: person-mask <frames-dir> <masks-dir>\n".data(using: .utf8)!); exit(1) }
let inDir = URL(fileURLWithPath: args[1]); let outDir = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let files = try FileManager.default.contentsOfDirectory(at: inDir, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }

let ctx = CIContext()
var done = 0
for f in files {
  autoreleasepool {
    guard let img = CIImage(contentsOf: f) else { return }
    let req = VNGeneratePersonSegmentationRequest()
    req.qualityLevel = .accurate
    req.outputPixelFormat = kCVPixelFormatType_OneComponent8
    let handler = VNImageRequestHandler(ciImage: img)
    try? handler.perform([req])
    guard let mask = req.results?.first?.pixelBuffer else { return }
    var maskImg = CIImage(cvPixelBuffer: mask)
    // upscale mask to frame size
    let sx = img.extent.width / maskImg.extent.width
    let sy = img.extent.height / maskImg.extent.height
    maskImg = maskImg.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
    let out = outDir.appendingPathComponent(f.lastPathComponent)
    try? ctx.writePNGRepresentation(of: maskImg, to: out, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
    done += 1
    if done % 24 == 0 { print("\(done)/\(files.count)") }
  }
}
print("masks: \(done)/\(files.count)")
