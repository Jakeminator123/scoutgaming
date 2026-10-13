export interface DealerFraming {scale:number;x:number;y:number}
export const DEFAULT_DEALER_FRAMING: Readonly<DealerFraming>;
export const DEFAULT_GREEN_SCREEN: Readonly<{mode:'green-screen';threshold:number;softness:number;despill:number}>;
export function validateDealerFraming(value:unknown):DealerFraming;
export function dealerFrameRect(sourceWidth:number,sourceHeight:number,width:number,height:number,framing?:DealerFraming):[number,number,number,number];
export function drawDealerFrame(context:CanvasRenderingContext2D,video:HTMLVideoElement|HTMLImageElement,width:number,height:number,framing?:DealerFraming,green?:boolean):void;
export function keyGreenPixels(data:Uint8ClampedArray,key:{threshold:number;softness:number;despill:number}):Uint8ClampedArray;
