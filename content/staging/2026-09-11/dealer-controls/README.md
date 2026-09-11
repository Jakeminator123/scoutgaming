# Pose-matched manual dealer controls

Open `astrid-controls.blend` in Blender. In the Text Editor, select **Dealer movement controls.py** and choose **Run Script**. In the 3D viewport, open the **N sidebar → Dealer**.

Choose a frame in an existing action with the limb's IK blend at zero. **Match pose and enable** places that wrist/foot target and its elbow/knee pole at the current evaluated pose, solves the pole roll, enables IK and selects the target. Move/rotate the target using Blender's normal G/R tools or the panel. Returning IK to zero restores the source FK animation at the current frame.

This is a manual authoring aid, not an automatic animation conversion. Duplicate an action before editing it. To animate a matched pose, key the target transform and IK blend, the pole transform, and the armature IK constraint's pole angle. Matching different frames without keying them does not create a motion clip. The body root and existing head/finger controls remain in the original rig.

The script refuses a match with more than 1 mm endpoint/elbow/knee error and restores FK on failure. `verification.json` records the evaluated whole-skeleton position residuals for the two outer seats and collection. These numerical checks do not certify natural motion, mesh collision clearance, or photographic appearance.

Source: `assets/astrid-3d/anatomical/astrid-animated.blend`. The original source and public model are unchanged. All twelve source actions are retained. The panel is embedded as an editable text and is not auto-executed on opening the file.

Rebuild and verify using the local bpy runtime with `pipeline/verify-dealer-ik-panel.py`. The first process saved successfully but crashed during bpy interpreter teardown; the artifact was independently reopened. The repeat verifier bypasses teardown only after all assertions, save and report have completed.
