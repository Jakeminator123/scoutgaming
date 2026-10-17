// Diagnostic marker-card extraction for this locked Astrid capture. Output is
// unapproved: missing observations remain null and require a retake/roto review.
import Foundation
import CoreImage
import CoreGraphics

let root=URL(fileURLWithPath:CommandLine.arguments[1])
let output=root.appendingPathComponent("contact-masks")
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
let files=try FileManager.default.contentsOfDirectory(at:root.appendingPathComponent("frames"),includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent<$1.lastPathComponent}
let ctx=CIContext(),space=CGColorSpaceCreateDeviceRGB()
let settingsURL=root.appendingPathComponent("capture-settings.json")
let settings=(try? JSONSerialization.jsonObject(with:Data(contentsOf:settingsURL))) as? [String:Any] ?? [:]
let region=settings["paperRegion"] as? [Double] ?? [0.455,0.565,0.66,0.82]
let subtractReference=settings["subtractReference"] as? Bool ?? false
let trackingStart=settings["trackingStart"] as? Int ?? 38
let exclusions=settings["excludeRegions"] as? [[Double]] ?? []
var records:[[String:Any]]=[]
var previous:[CGPoint]=[]
func pixels(_ img:CIImage,_ w:Int,_ h:Int)->[UInt8]{var data=[UInt8](repeating:0,count:w*h*4);ctx.render(img,toBitmap:&data,rowBytes:w*4,bounds:img.extent,format:.RGBA8,colorSpace:space);return data}
let reference=CIImage(contentsOf:files.first!)!
let baseline=pixels(reference,Int(reference.extent.width),Int(reference.extent.height))
func hull(_ points:[CGPoint])->[CGPoint]{
  let sorted=points.sorted{$0.x == $1.x ? $0.y < $1.y : $0.x < $1.x}
  func cross(_ a:CGPoint,_ b:CGPoint,_ c:CGPoint)->CGFloat{(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
  var lower:[CGPoint]=[],upper:[CGPoint]=[]
  for p in sorted {while lower.count>=2 && cross(lower[lower.count-2],lower.last!,p)<=0{lower.removeLast()};lower.append(p)}
  for p in sorted.reversed(){while upper.count>=2 && cross(upper[upper.count-2],upper.last!,p)<=0{upper.removeLast()};upper.append(p)}
  return Array(lower.dropLast())+Array(upper.dropLast())
}
func rectangle(_ points:[CGPoint])->[CGPoint]{
  let boundary=hull(points);if boundary.count<4{return []}
  var best=CGFloat.infinity,result:[CGPoint]=[]
  for i in boundary.indices {
    let a=boundary[i],b=boundary[(i+1)%boundary.count],theta=atan2(b.y-a.y,b.x-a.x),co=cos(theta),si=sin(theta)
    var loX=CGFloat.infinity,hiX = -CGFloat.infinity,loY=CGFloat.infinity,hiY = -CGFloat.infinity
    for p in boundary {let x=p.x*co+p.y*si,y = -p.x*si+p.y*co;loX=min(loX,x);hiX=max(hiX,x);loY=min(loY,y);hiY=max(hiY,y)}
    let area=(hiX-loX)*(hiY-loY)
    if area<best {best=area;result=[CGPoint(x:loX,y:loY),CGPoint(x:hiX,y:loY),CGPoint(x:hiX,y:hiY),CGPoint(x:loX,y:hiY)].map{CGPoint(x:$0.x*co-$0.y*si,y:$0.x*si+$0.y*co)}}
  }
  return result
}
for (frame,file) in files.enumerated(){autoreleasepool{
  guard let source=CIImage(contentsOf:file),let person=CIImage(contentsOf:root.appendingPathComponent("person").appendingPathComponent(file.lastPathComponent)) else{return}
  let w=Int(source.extent.width),h=Int(source.extent.height),rgb=pixels(source,w,h),alpha=pixels(person,w,h)
  var mask=[UInt8](repeating:0,count:w*h*4),paper=[Bool](repeating:false,count:w*h)
  for y in 0..<h {for x in 0..<w {
    let i=(y*w+x)*4,r=Int(rgb[i]),g=Int(rgb[i+1]),b=Int(rgb[i+2])
    let excluded=exclusions.contains{box in Double(x)>Double(w)*box[0]&&Double(x)<Double(w)*box[2]&&Double(y)>Double(h)*box[1]&&Double(y)<Double(h)*box[3]}
    let roi = !excluded && x>Int(Double(w)*region[0])&&x<Int(Double(w)*region[2])&&y>Int(Double(h)*region[1])&&y<Int(Double(h)*region[3])
    let marker=roi&&r>190&&g>180&&b>140&&abs(r-g)<30&&abs(g-b)<60
    let skin=r>80&&r-g>22&&g-b>8
    let changed=abs(r-Int(baseline[i]))+abs(g-Int(baseline[i+1]))+abs(b-Int(baseline[i+2]))>90
    paper[y*w+x]=marker && (subtractReference ? changed : !(Double(x)>Double(w)*0.635 && Double(y)<Double(h)*0.626))
    let actor:UInt8=(marker && !skin) ? 0 : alpha[i]
    mask[i]=actor;mask[i+1]=(roi&&skin) ? actor : 0;mask[i+2]=0;mask[i+3]=255
  }}
  var largest:[Int]=[]
  if frame>=trackingStart {for index in paper.indices where paper[index] {
    var component:[Int]=[index],offset=0;paper[index]=false
    while offset<component.count {
      let p=component[offset];offset+=1
      for n in [p-1,p+1,p-w,p+w] where n>=0&&n<paper.count&&paper[n] {paper[n]=false;component.append(n)}
    }
    if component.count>largest.count{largest=component}
  }}
  var record:[String:Any]=["frame":frame,"paperPixels":largest.count,"corners":NSNull()]
  if largest.count>120 {
    let points=largest.map{CGPoint(x:$0%w,y:$0/w)}
    let box=rectangle(points)
    if box.count==4 {
      var ordered=box
      if previous.count==4 {
        var score=CGFloat.infinity
        for shift in 0..<4 {let candidate=(0..<4).map{box[($0+shift)%4]};var distance:CGFloat=0
          for i in 0..<4{distance += pow(candidate[i].x-previous[i].x,2)+pow(candidate[i].y-previous[i].y,2)}
          if distance<score{score=distance;ordered=candidate}
        }
      }else{let start=box.indices.min{box[$0].x+box[$0].y<box[$1].x+box[$1].y}!;ordered=(0..<4).map{box[($0+start)%4]}}
      previous=ordered;record["corners"]=ordered.map{[Double($0.x)/Double(w),Double($0.y)/Double(h),0]}
    }
  }
  records.append(record)
  let data=Data(mask),bitmap=CIImage(bitmapData:data,bytesPerRow:w*4,size:CGSize(width:w,height:h),format:.RGBA8,colorSpace:space)
  try? ctx.writePNGRepresentation(of:bitmap,to:output.appendingPathComponent(file.lastPathComponent),format:.RGBA8,colorSpace:space)
}}
try JSONSerialization.data(withJSONObject:records,options:[.sortedKeys]).write(to:root.appendingPathComponent("marker-tracking.json"))
print("Prepared \(records.count) diagnostic mask frames. No visual approval implied.")
