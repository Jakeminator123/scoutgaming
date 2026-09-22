# Green-screen WAITING loop for Astrid (in-game idle between hands)

Kevin 2026-09-19 ~19:00: "lets do a greenscreen we need this [the in-game waiting idle] in that; find our old prompt and ref files".

Original (27 Aug) idle: job f599e503-f839-4e7b-b780-cbe8412adb84, seedance_2_5, 6s, 1:1, omni_reference,
start_image = end_image = content/persona/roster/astrid-canonical.png. Prompt:
"Continue this exact static shot, same camera, same framing, same lighting: a blonde dealer in a black blazer at a dark casino table with an illuminated rail, dark hall with linear pendant lights behind. She rests calmly, breathing naturally, subtle eye movement, hands folded on the rail. She does not speak. No camera movement."

Green version: job 15777d5f-4085-484e-a170-eb5c9a13d7b0, seedance_2_0, 5s, 1080p, std, high bitrate, silent, 16:9.
Inputs: start_image = end_image = 269f8943 (approved elevated green plate, ready pose), image = b2c16866 (ref-identity.png).
Prompt: rests calmly, breathing, glances left / right / back to camera, blink, slight head turn, hands stay in ready positions with tiny finger adjustments, no dealing, card and shoe stationary, lips closed, begin and end in the supplied pose (loop).
Balance before: 3463.13.

Result: source.mp4 1920x1080 24fps 121 frames, sha256 849b241e6a9b769bef1cd40299516c25f1a5aba28bf865b2d3593854731765bf.
Loop seam: frame 0 vs frame 120 mean abs diff 1.44 (loops). Cost 45 credits (16:16 UTC). Balance after 3292.13.
NOTE: two other Seedance spends today (15:05 UTC -54, 15:56 UTC -72) are NOT from this session.
Copied to assets/astrid-3d/greenscreen/take-waiting-seedance.mp4. Not installed; Kevin reviews.
