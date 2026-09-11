"""Run this text in Blender to expose pose-matched dealer IK controls.

No animation curves are changed. Save authored IK keys separately from source FK.
"""
import math
import bpy
from mathutils import Vector


def refresh(control=None):
    if control:
        control.update_tag(refresh={'OBJECT'})
    bpy.context.view_layer.update()


def snap_ik(arm, side, kind):
    """Match world-space target, orientation and pole to the evaluated FK pose."""
    upper, lower, end = ((side+'Arm', side+'ForeArm', side+'Hand')
                         if kind == 'WRIST' else
                         (side+'UpLeg', side+'Leg', side+'Foot'))
    target = bpy.data.objects['CTRL_'+side.upper()+'_'+kind]
    pole = bpy.data.objects['CTRL_'+side.upper()+('_ELBOW' if kind == 'WRIST' else '_KNEE')]
    if target['IK'] != 0:
        raise ValueError('Set IK to 0 before matching the current FK pose.')
    refresh()
    a, b, c = [arm.matrix_world @ arm.pose.bones[n].head for n in (upper, lower, end)]
    end_matrix = arm.matrix_world @ arm.pose.bones[end].matrix
    direction = (c-a).normalized()
    bend = (b-a)-direction*(b-a).dot(direction)
    if bend.length < 1e-6:
        bend = (pole.matrix_world.translation-b)
        bend -= direction*direction.dot(bend)
    if bend.length < 1e-6:
        bend = direction.cross(Vector((0, 0, 1)))
    if bend.length < 1e-6:
        bend = direction.cross(Vector((0, 1, 0)))
    saved = (target.matrix_world.copy(), pole.matrix_world.copy())
    ik = next(k for k in arm.pose.bones[lower].constraints if k.type == 'IK')
    original_angle = ik.pole_angle
    try:
        target.matrix_world = end_matrix
        pole.matrix_world.translation = b+bend.normalized()*.25
        target['IK'] = 1.0
        refresh(target)

        def error(angle):
            ik.pole_angle = angle
            refresh()
            return (arm.matrix_world @ arm.pose.bones[lower].head-b).length_squared

        step = math.tau/72
        best = min((-math.pi+i*step for i in range(72)), key=error)
        lo, hi = best-step, best+step
        for _ in range(22):
            x, y = lo+(hi-lo)/3, hi-(hi-lo)/3
            if error(x) < error(y):
                hi = y
            else:
                lo = x
        error((lo+hi)/2)
        residual = max((arm.matrix_world @ arm.pose.bones[lower].head-b).length,
                       (arm.matrix_world @ arm.pose.bones[end].head-c).length)
        if residual > .001:
            raise ValueError(f'Pose match exceeds 1 mm ({residual*1000:.2f} mm); FK restored.')
        return residual
    except Exception:
        target['IK'] = 0.0
        target.matrix_world, pole.matrix_world = saved
        ik.pole_angle = original_angle
        refresh(target)
        raise


class DEALER_OT_snap_ik(bpy.types.Operator):
    bl_idname = 'dealer.snap_ik'
    bl_label = 'Match pose and enable IK'
    bl_options = {'REGISTER', 'UNDO'}
    side: bpy.props.StringProperty()
    kind: bpy.props.StringProperty()

    def execute(self, context):
        arm = next((o for o in context.scene.objects if o.type == 'ARMATURE' and 'LeftHand' in o.pose.bones), None)
        try:
            if arm is None:
                raise ValueError('Dealer armature not found')
            snap_ik(arm, self.side, self.kind)
        except (ValueError, KeyError, StopIteration) as exc:
            self.report({'ERROR'}, str(exc))
            return {'CANCELLED'}
        control = bpy.data.objects['CTRL_'+self.side.upper()+'_'+self.kind]
        if context.object and context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        for obj in context.selected_objects:
            obj.select_set(False)
        control.select_set(True)
        context.view_layer.objects.active = control
        return {'FINISHED'}


class DEALER_PT_controls(bpy.types.Panel):
    bl_label = 'Dealer movement'
    bl_idname = 'DEALER_PT_controls'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Dealer'

    def draw(self, context):
        layout = self.layout
        layout.label(text='Choose an FK frame, then match a control.')
        for side in ('Left', 'Right'):
            for kind in ('WRIST', 'FOOT'):
                control = bpy.data.objects.get('CTRL_'+side.upper()+'_'+kind)
                if control is None:
                    continue
                box = layout.box()
                box.label(text=side+' '+kind.lower())
                box.prop(control, '["IK"]', text='IK blend', slider=True)
                row = box.row()
                row.enabled = control['IK'] == 0
                op = row.operator('dealer.snap_ik', text='Match pose and enable')
                op.side, op.kind = side, kind
                box.prop(control, 'location', text='Position')
                box.prop(control, 'rotation_quaternion', text='Rotation')
        layout.label(text='Key IK blend and targets to save manual motion.')
        layout.label(text='IK 0 returns to the original FK animation.')


def register():
    for cls in (DEALER_OT_snap_ik, DEALER_PT_controls):
        old = getattr(bpy.types, cls.__name__, None)
        if old:
            bpy.utils.unregister_class(old)
        bpy.utils.register_class(cls)


if __name__ == '__main__':
    register()
