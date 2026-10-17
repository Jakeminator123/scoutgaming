"""Exact CPU-only frame contract shared by admission and the renderer."""
PCM_RATE = 24000
FPS = 24
LEAD_SAMPLES = 5280
TRAIL_SAMPLES = 12720
SAMPLES_PER_FRAME = PCM_RATE // FPS


def pcm_frames(byte_count, rate=PCM_RATE):
    if type(byte_count) is not int or byte_count <= 0 or byte_count % 2 or rate != PCM_RATE:
        raise ValueError("invalid_pcm")
    return (byte_count // 2 + LEAD_SAMPLES + TRAIL_SAMPLES) // SAMPLES_PER_FRAME


def resolve_plan(mapping, rows, total):
    """Resolve exact source identities; rest is always frame zero of one image."""
    if type(total) is not int or total < 1 or not isinstance(rows, list) or not rows:
        raise ValueError("invalid_frame_plan")
    result = []
    for row in rows:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError("invalid_frame_plan")
        take, first, count = row
        if (not isinstance(take, str) or type(first) is not int or first < 0
                or type(count) is not int or count < 1 or len(result) + count > total):
            raise ValueError("invalid_frame_plan")
        if take == "vila":
            if first != 0:
                raise ValueError("invalid_frame_plan")
            result.extend((take, 0, mapping["vila"]) for _ in range(count))
        else:
            ids = mapping["takes"].get(take)
            if not ids or first + count > len(ids):
                raise ValueError("invalid_frame_plan")
            result.extend((take, frame, ids[frame]) for frame in range(first, first + count))
    if len(result) != total:
        raise ValueError("frame_plan_length_mismatch")
    return result


def measurement_plan(mapping, total):
    """A real source sequence, followed by explicit rest if the take is shorter."""
    take = max(mapping["takes"], key=lambda key: len(mapping["takes"][key]))
    count = min(total, len(mapping["takes"][take]))
    rows = [[take, 0, count]]
    if count < total:
        rows.append(["vila", 0, total - count])
    resolve_plan(mapping, rows, total)
    return rows
