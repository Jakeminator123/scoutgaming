#!/bin/sh
# Paid generation. Do not run again if a job was already submitted; inspect generation.log/mesh-job.json first.
# Tripo's documented ordered inputs: front, left, back, right.
# Quad output may be FBX; inspect actual result before naming/converting it.
/Users/solvifyab/.local/bin/higgsfield generate create tripo_h3_1_multiview_to_3d --image 431f1aa2-bfdc-4478-8308-e6f97ccb9fc7 --image d65c82a3-5e3b-44f5-8a6d-64ccf00b3dc7 --image 85627833-35d5-446b-8595-fa539a0b1a71 --image 5581bcba-e2b1-4f28-9f5a-c2cc032371c6 --face_limit 120000 --texture true --pbr true --texture_quality detailed --geometry_quality detailed --quad true --texture_alignment original_image --auto_size true --orientation align_image --wait --wait-timeout 20m --wait-interval 10s --json > mesh-job.json 2> generation.log
