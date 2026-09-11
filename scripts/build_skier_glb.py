"""
build_skier_glb.py
Headless Blender 5.2 Python Pipeline
Generates an authentic, high-fidelity athletic 3D Downhill Skier model (.glb):
- Anatomically contoured speed suit (Alpine Gold livery, aerodynamic black compression panels, red accents)
- Aerodynamic teardrop World Cup racing helmet with wrap-around mirrored polarized goggles & gaiter
- Articulated downhill racing crouch kinematics with forward shin cant & molded race boots
- Continuous rockered twin-tip downhill skis with steel edges & Look Pivot style bindings
- Authentic downhill pole carriage (grips at hip height, shafts angled down and back toward snow)
- Scoped tactical harpoon rifle slung diagonally across backpack
- Full PBR materials (Principled BSDF) baked into binary glTF 2.0 (skier.glb)
"""

import bpy
import bmesh
import math
import os

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, base_color, roughness=0.4, metallic=0.0, clearcoat=0.0, specular=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        output = nodes.get("Material Output")
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    
    # Clearcoat input check (Blender 4.0+ moved clearcoat to Coat)
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    elif "Clearcoat" in bsdf.inputs:
        bsdf.inputs["Clearcoat"].default_value = clearcoat
        
    return mat

def build_skier():
    clear_scene()

    # ==========================================
    # PBR MATERIALS SETUP
    # ==========================================
    mat_gold = create_material("SuitGold", (0.88, 0.65, 0.12, 1.0), roughness=0.38, metallic=0.05)
    mat_black = create_material("SuitBlack", (0.05, 0.05, 0.06, 1.0), roughness=0.55, metallic=0.0)
    mat_red = create_material("RacingRed", (0.92, 0.10, 0.12, 1.0), roughness=0.32, metallic=0.0)
    mat_helmet = create_material("HelmetCarbon", (0.04, 0.04, 0.05, 1.0), roughness=0.12, metallic=0.10, clearcoat=1.0)
    mat_visor = create_material("GoggleVisor", (0.95, 0.82, 0.30, 1.0), roughness=0.04, metallic=0.98, specular=1.0)
    mat_ski = create_material("SkiCarbon", (0.07, 0.08, 0.10, 1.0), roughness=0.25, metallic=0.05)
    mat_steel = create_material("SteelEdge", (0.84, 0.86, 0.90, 1.0), roughness=0.15, metallic=0.95)
    mat_boot = create_material("BootShell", (0.06, 0.08, 0.12, 1.0), roughness=0.20, metallic=0.10, clearcoat=0.6)
    mat_gunmetal = create_material("Gunmetal", (0.22, 0.24, 0.27, 1.0), roughness=0.22, metallic=0.92)
    mat_lens = create_material("ScopeLens", (0.05, 0.25, 0.40, 1.0), roughness=0.05, metallic=0.85, specular=1.0)
    mat_gaiter = create_material("FaceGaiter", (0.03, 0.03, 0.04, 1.0), roughness=0.85, metallic=0.0)

    # Collection for all character parts
    col = bpy.context.scene.collection

    # ==========================================
    # 1. TORSO & RACING SPEED SUIT
    # ==========================================
    # Upper Chest (Athletic tapered cylinder)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.22, depth=0.46, location=(0, 0, 1.16))
    chest = bpy.context.active_object
    chest.name = "SkierChest"
    chest.scale.y = 0.74 # Flatten front-to-back for human ribcage
    chest.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Left Shoulder Deltoid
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=0.09, location=(-0.24, 0, 1.32))
    shoulder_l = bpy.context.active_object
    shoulder_l.name = "ShoulderL"
    shoulder_l.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Right Shoulder Deltoid
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=0.09, location=(0.24, 0, 1.32))
    shoulder_r = bpy.context.active_object
    shoulder_r.name = "ShoulderR"
    shoulder_r.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Athletic Tapered Waist / Abdomen
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.18, depth=0.34, location=(0, 0, 0.82))
    waist = bpy.context.active_object
    waist.name = "SkierWaist"
    waist.scale.y = 0.74
    waist.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Tactical Compression Flanks (Left & Right)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.06, depth=0.48, location=(-0.21, 0, 1.12))
    flank_l = bpy.context.active_object
    flank_l.name = "FlankL"
    flank_l.scale.y = 1.4
    flank_l.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.06, depth=0.48, location=(0.21, 0, 1.12))
    flank_r = bpy.context.active_object
    flank_r.name = "FlankR"
    flank_r.scale.y = 1.4
    flank_r.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # Front Racing Red Pinstripe
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.165, 1.16))
    stripe = bpy.context.active_object
    stripe.name = "RaceStripe"
    stripe.scale = (0.04, 0.015, 0.46)
    stripe.data.materials.append(mat_red)
    bpy.ops.object.shade_smooth()

    # Tactical Waist Belt & Alloy Buckle
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.185, depth=0.07, location=(0, 0, 0.68))
    belt = bpy.context.active_object
    belt.name = "TacticalBelt"
    belt.scale.y = 0.76
    belt.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.145, 0.68))
    buckle = bpy.context.active_object
    buckle.name = "BeltBuckle"
    buckle.scale = (0.08, 0.03, 0.05)
    buckle.data.materials.append(mat_steel)

    # Neck Collar Cowl
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.11, depth=0.12, location=(0, 0, 1.42))
    collar = bpy.context.active_object
    collar.name = "NeckCollar"
    collar.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # ==========================================
    # 2. TACTICAL STREAMLINED BACKPACK
    # ==========================================
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.12, depth=0.42, location=(0, 0.18, 1.14))
    pack = bpy.context.active_object
    pack.name = "TacticalPack"
    pack.scale.y = 0.60
    pack.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # Diagonal Rifle Scabbard Across Pack
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.035, depth=0.58, location=(0.04, 0.24, 1.18))
    scabbard = bpy.context.active_object
    scabbard.name = "RifleScabbard"
    scabbard.rotation_euler = (0, math.radians(25), math.radians(-35))
    scabbard.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # ==========================================
    # 3. HEAD, RACING HELMET & MIRRORED GOGGLES
    # ==========================================
    # Aerodynamic Teardrop Racing Helmet
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=20, radius=0.18, location=(0, 0, 1.56))
    helmet = bpy.context.active_object
    helmet.name = "RacingHelmet"
    helmet.scale = (1.0, 1.06, 1.14)
    helmet.data.materials.append(mat_helmet)
    bpy.ops.object.shade_smooth()

    # Wrap-Around Mirrored Polarized Snow Goggles
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.188, depth=0.10, location=(0, -0.02, 1.58))
    visor = bpy.context.active_object
    visor.name = "MirroredVisor"
    visor.scale.y = 0.85
    visor.data.materials.append(mat_visor)
    bpy.ops.object.shade_smooth()

    # Goggle Elastic Strap
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.185, depth=0.045, location=(0, 0, 1.58))
    strap = bpy.context.active_object
    strap.name = "GoggleStrap"
    strap.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # Lower Face Balaclava Gaiter
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.115, depth=0.14, location=(0, -0.03, 1.45))
    gaiter = bpy.context.active_object
    gaiter.name = "FaceGaiter"
    gaiter.data.materials.append(mat_gaiter)
    bpy.ops.object.shade_smooth()

    # ==========================================
    # 4. ARTICULATED LEGS & RACING SKI BOOTS
    # ==========================================
    # Left Thigh (Muscular Quad, flexed downhill forward crouch)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.09, depth=0.48, location=(-0.15, 0.03, 0.58))
    thigh_l = bpy.context.active_object
    thigh_l.name = "ThighL"
    thigh_l.rotation_euler.x = math.radians(-14)
    thigh_l.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Left Knee Armor Guard
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=14, radius=0.08, location=(-0.15, -0.03, 0.36))
    knee_l = bpy.context.active_object
    knee_l.name = "KneeL"
    knee_l.scale.y = 0.75
    knee_l.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # Left Shin / Calf (Forward canted 18 degrees)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.065, depth=0.40, location=(-0.15, -0.05, 0.20))
    shin_l = bpy.context.active_object
    shin_l.name = "ShinL"
    shin_l.rotation_euler.x = math.radians(16)
    shin_l.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Left Molded Alpine Racing Ski Boot
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.15, -0.08, 0.08))
    boot_l = bpy.context.active_object
    boot_l.name = "BootL"
    boot_l.scale = (0.12, 0.30, 0.14)
    boot_l.data.materials.append(mat_boot)
    bpy.ops.object.shade_smooth()

    # Left Boot Buckles
    for i, b_pos in enumerate([-0.02, 0.05]):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.15, b_pos - 0.08, 0.14))
        b_mesh = bpy.context.active_object
        b_mesh.name = f"BootBuckleL_{i}"
        b_mesh.scale = (0.13, 0.04, 0.02)
        b_mesh.data.materials.append(mat_steel)

    # Right Thigh (Muscular Quad, flexed downhill forward crouch)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.09, depth=0.48, location=(0.15, 0.03, 0.58))
    thigh_r = bpy.context.active_object
    thigh_r.name = "ThighR"
    thigh_r.rotation_euler.x = math.radians(-14)
    thigh_r.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Right Knee Armor Guard
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=14, radius=0.08, location=(0.15, -0.03, 0.36))
    knee_r = bpy.context.active_object
    knee_r.name = "KneeR"
    knee_r.scale.y = 0.75
    knee_r.data.materials.append(mat_black)
    bpy.ops.object.shade_smooth()

    # Right Shin / Calf
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.065, depth=0.40, location=(0.15, -0.05, 0.20))
    shin_r = bpy.context.active_object
    shin_r.name = "ShinR"
    shin_r.rotation_euler.x = math.radians(16)
    shin_r.data.materials.append(mat_gold)
    bpy.ops.object.shade_smooth()

    # Right Molded Alpine Racing Ski Boot
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.15, -0.08, 0.08))
    boot_r = bpy.context.active_object
    boot_r.name = "BootR"
    boot_r.scale = (0.12, 0.30, 0.14)
    boot_r.data.materials.append(mat_boot)
    bpy.ops.object.shade_smooth()

    # Right Boot Buckles
    for i, b_pos in enumerate([-0.02, 0.05]):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.15, b_pos - 0.08, 0.14))
        b_mesh = bpy.context.active_object
        b_mesh.name = f"BootBuckleR_{i}"
        b_mesh.scale = (0.13, 0.04, 0.02)
        b_mesh.data.materials.append(mat_steel)

    # ==========================================
    # 5. HIGH-PERFORMANCE DOWNHILL RACING SKIS
    # ==========================================
    ski_sep = 0.24
    ski_len = 2.10
    ski_width = 0.14
    ski_thick = 0.028

    for side, sign, name_suffix in [("L", -1, "Left"), ("R", 1, "Right")]:
        x_pos = sign * ski_sep

        # Main Carbon Ski Plank
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, 0, 0.014))
        ski = bpy.context.active_object
        ski.name = f"Ski_{side}"
        ski.scale = (ski_width, ski_len, ski_thick)
        ski.data.materials.append(mat_ski)
        bpy.ops.object.shade_smooth()

        # Stainless Steel Side Edges
        for edge_side, edge_sign in [("Outer", -1), ("Inner", 1)]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos + edge_sign * (ski_width/2 - 0.004), 0, 0.014))
            edge = bpy.context.active_object
            edge.name = f"SkiEdge_{side}_{edge_side}"
            edge.scale = (0.008, ski_len, ski_thick)
            edge.data.materials.append(mat_steel)

        # Seamless Rockered Tip Scoop (Integrated upward curve, ZERO floating gap!)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, -ski_len/2 + 0.12, 0.052))
        tip = bpy.context.active_object
        tip.name = f"SkiTip_{side}"
        tip.scale = (ski_width, 0.26, ski_thick)
        tip.rotation_euler.x = math.radians(24)
        tip.data.materials.append(mat_red)
        bpy.ops.object.shade_smooth()

        # Twin-Tip Tail Kick
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, ski_len/2 - 0.08, 0.032))
        tail = bpy.context.active_object
        tail.name = f"SkiTail_{side}"
        tail.scale = (ski_width, 0.18, ski_thick)
        tail.rotation_euler.x = math.radians(-14)
        tail.data.materials.append(mat_red)
        bpy.ops.object.shade_smooth()

        # Look Pivot Racing Toe Clamp
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x_pos, -0.22, 0.045))
        toe = bpy.context.active_object
        toe.name = f"BindingToe_{side}"
        toe.scale = (0.10, 0.12, 0.05)
        toe.data.materials.append(mat_black)

        # Look Pivot Turntable Heel Unit
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=0.06, location=(x_pos, 0.08, 0.05))
        heel = bpy.context.active_object
        heel.name = f"BindingHeel_{side}"
        heel.data.materials.append(mat_black)

    # ==========================================
    # 6. ARMS, GLOVES & DOWNHILL SKI POLES
    # ==========================================
    for side, sign, name_suffix in [("L", -1, "Left"), ("R", 1, "Right")]:
        arm_x = sign * 0.26

        # Upper Arm (Tapered biceps, naturally angled downward/forward)
        bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.055, depth=0.32, location=(arm_x, -0.02, 1.20))
        u_arm = bpy.context.active_object
        u_arm.name = f"UpperArm_{side}"
        u_arm.rotation_euler = (math.radians(-20), 0, math.radians(-sign * 12))
        u_arm.data.materials.append(mat_gold)
        bpy.ops.object.shade_smooth()

        # Elbow Joint
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=12, radius=0.055, location=(arm_x, -0.07, 1.05))
        elbow = bpy.context.active_object
        elbow.name = f"Elbow_{side}"
        elbow.data.materials.append(mat_black)
        bpy.ops.object.shade_smooth()

        # Forearm (Bent forward at waist level in athletic carriage)
        bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.045, depth=0.30, location=(arm_x, -0.18, 0.96))
        forearm = bpy.context.active_object
        forearm.name = f"Forearm_{side}"
        forearm.rotation_euler = (math.radians(45), 0, math.radians(-sign * 8))
        forearm.data.materials.append(mat_gold)
        bpy.ops.object.shade_smooth()

        # Gloved Fist
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=12, radius=0.055, location=(arm_x, -0.28, 0.88))
        glove = bpy.context.active_object
        glove.name = f"Glove_{side}"
        glove.data.materials.append(mat_black)
        bpy.ops.object.shade_smooth()

        # DOWNHILL SKI POLE (Shaft angles DOWN and GENTLY BACKWARD toward snow!)
        pole_x = sign * 0.32
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.009, depth=1.20, location=(pole_x, 0.12, 0.44))
        pole = bpy.context.active_object
        pole.name = f"Pole_{side}"
        pole.rotation_euler = (math.radians(-68), 0, math.radians(-sign * 6))
        pole.data.materials.append(mat_gunmetal)
        bpy.ops.object.shade_smooth()

        # Aerodynamic Racing Snow Basket
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.015, location=(pole_x, 0.58, 0.08))
        basket = bpy.context.active_object
        basket.name = f"PoleBasket_{side}"
        basket.rotation_euler = (math.radians(-68), 0, math.radians(-sign * 6))
        basket.data.materials.append(mat_black)

        # Tungsten Carbide Tip
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.009, radius2=0.002, depth=0.04, location=(pole_x, 0.62, 0.04))
        tip_mesh = bpy.context.active_object
        tip_mesh.name = f"PoleTip_{side}"
        tip_mesh.rotation_euler = (math.radians(-68), 0, math.radians(-sign * 6))
        tip_mesh.data.materials.append(mat_steel)

    # ==========================================
    # 7. ALWAYS-VISIBLE TACTICAL HARPOON RIFLE
    # ==========================================
    # Receiver / Stock (Slung diagonally across backpack)
    rifle_loc = (0.10, 0.28, 1.28)
    rifle_rot = (math.radians(15), math.radians(22), math.radians(52))

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=rifle_loc)
    r_body = bpy.context.active_object
    r_body.name = "HarpoonRifle_Body"
    r_body.scale = (0.05, 0.72, 0.09)
    r_body.rotation_euler = rifle_rot
    r_body.data.materials.append(mat_gunmetal)
    bpy.ops.object.shade_smooth()

    # Fluted Precision Barrel
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.016, depth=0.62, location=(0.04, 0.45, 1.48))
    r_barrel = bpy.context.active_object
    r_barrel.name = "HarpoonRifle_Barrel"
    r_barrel.rotation_euler = (math.radians(15), math.radians(22), math.radians(52))
    r_barrel.data.materials.append(mat_gunmetal)
    bpy.ops.object.shade_smooth()

    # Muzzle Brake
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.024, depth=0.07, location=(0.01, 0.54, 1.58))
    r_muzzle = bpy.context.active_object
    r_muzzle.name = "HarpoonRifle_Muzzle"
    r_muzzle.rotation_euler = (math.radians(15), math.radians(22), math.radians(52))
    r_muzzle.data.materials.append(mat_black)

    # High-Power Optical Scope
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.023, depth=0.32, location=(0.13, 0.26, 1.34))
    r_scope = bpy.context.active_object
    r_scope.name = "HarpoonRifle_Scope"
    r_scope.rotation_euler = (math.radians(15), math.radians(22), math.radians(52))
    r_scope.data.materials.append(mat_black)

    # Scope Objective Lens
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.020, depth=0.01, location=(0.07, 0.38, 1.46))
    r_lens = bpy.context.active_object
    r_lens.name = "HarpoonRifle_Lens"
    r_lens.rotation_euler = (math.radians(15), math.radians(22), math.radians(52))
    r_lens.data.materials.append(mat_lens)

    # Red Cable Drum Spool
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.08, location=(0.12, 0.24, 1.22))
    r_spool = bpy.context.active_object
    r_spool.name = "HarpoonRifle_Spool"
    r_spool.rotation_euler = (math.radians(15), math.radians(22), math.radians(52))
    r_spool.data.materials.append(mat_red)

    # ==========================================
    # 8. HIERARCHY & ROOT ANCHOR
    # ==========================================
    # Select all created mesh objects
    bpy.ops.object.select_all(action='SELECT')
    
    # Export to public/assets/skier.glb
    output_path = os.path.abspath(r"C:\dev\skifree-yeti-do\public\assets\skier.glb")
    print(f"[Blender] Exporting athletic skier model to {output_path}...")

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
    )

    print(f"✅ [Blender] Successfully exported skier.glb! File size: {os.path.getsize(output_path):,} bytes")

if __name__ == "__main__":
    build_skier()
