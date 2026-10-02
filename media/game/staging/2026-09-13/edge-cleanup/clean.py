"""Remove upper-body matte protrusions containing captured background lamps.
Never modifies hand coverage, card/finger channels, timing, or RGB values before encoding.
"""
import numpy as np,cv2

def clean_upper(m):
    core=(m>200).astype('uint8')*255
    core=cv2.morphologyEx(core,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)))
    core=cv2.erode(core,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    core=cv2.GaussianBlur(core,(7,7),1.3)
    weight=np.clip((460-np.arange(m.shape[0]))/40,0,1)[:,None]
    return (m*(1-weight)+np.minimum(m,core)*weight).astype('uint8')
