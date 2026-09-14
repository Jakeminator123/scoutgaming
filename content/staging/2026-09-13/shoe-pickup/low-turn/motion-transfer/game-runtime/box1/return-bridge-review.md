# Box1 return-to-idle compatibility

Compared box1 source native96 against idle-registration/bridge-pair/source.mp4 native0 at the same camera coordinates. Existing bridge SHA2568fcb7b93bdc5079f67ba13bcfde70d5703307b766422c383f726112256e6a02c ends at the real crossed-arm idle, but does not start at the new box1 end pose.

Agent measurements: approximate face displacement12.51nativepx (29inliers), receiving hand18.29px (5matches), shoe hand11.86px (3inliers, weak). Root independently inspected return-bridge-comparison.jpg: head tilt and both hand poses visibly differ. A face fit cannot justify warping the whole actor because hand transforms disagree. No drop-in compatible bridge was found in this bounded inspection. Do not splice this bridge and call the transition repaired. No runtime change.
