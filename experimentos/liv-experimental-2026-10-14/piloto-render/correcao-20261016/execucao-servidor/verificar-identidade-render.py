"""Server-only diagnostic: render the complete old60k model in the dense context.

No cropping, concatenation, optimizer changes, training, or camera transforms.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os


IDS = ("f0592", "f1260", "f1662", "f0781", "f0896", "f1832", "f2322")
KEYS = ("means", "features_dc", "features_rest", "opacities", "scales", "quats")


def unique_file(paths, label):
    candidates = sorted(paths)
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one {label}, found {candidates}")
    return candidates[0]


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/root/liv-corrigido-20261016"))
    args = parser.parse_args()
    root = args.root.resolve()
    os.chdir(root)

    # Import and initialize these packages only when running on the server.
    import numpy as np
    import torch
    from PIL import Image, ImageDraw
    from nerfstudio.utils.eval_utils import eval_setup

    torch.set_num_threads(2)
    torch.set_num_interop_threads(2)
    cfg = unique_file((root / "treino-denso16-corrigido").glob("**/config.yml"), "dense config")
    old_cp = unique_file((root / "treino-refino60k").glob("**/step-000059999.ckpt"), "old60k checkpoint")
    report_path = root / "resultado-refino60k/analise-ambientes/metricas-por-ambiente.json"
    old_report = json.loads(report_path.read_text(encoding="utf-8"))
    old_views = {}
    for view in old_report["views"]:
        name = Path(view["file"]).name
        if name in old_views:
            raise RuntimeError(f"Duplicate old report filename: {name}")
        old_views[name] = view

    config, pipeline, dense_cp, dense_step = eval_setup(cfg, test_mode="test")
    state = torch.load(old_cp, map_location="cpu", weights_only=False)
    parameters = {key: state["pipeline"]["_model.gauss_params." + key] for key in KEYS}
    count = len(parameters["means"])
    assert count > 1000
    for key, value in parameters.items():
        assert len(value) == count and torch.isfinite(value).all(), key
        assert value.shape[1:] == pipeline.model.gauss_params[key].shape[1:], key
        # Preserve every point and its original ordering; replace all six tensors.
        pipeline.model.gauss_params[key] = torch.nn.Parameter(
            value.to(pipeline.device), requires_grad=False
        )
    del state, parameters
    pipeline.eval()

    dataset = pipeline.datamanager.eval_dataset
    filenames = getattr(dataset, "image_filenames", None)
    filename_source = "eval_dataset.image_filenames"
    if filenames is None:
        filenames = dataset._dataparser_outputs.image_filenames
        filename_source = "eval_dataset._dataparser_outputs.image_filenames"
    filenames = list(filenames)
    assert len(filenames) == len(dataset.cameras)
    indices = {}
    for index, filename in enumerate(filenames):
        name = Path(filename).name
        if name in indices:
            raise RuntimeError(f"Duplicate eval dataset filename: {name}")
        indices[name] = index

    output = root / "verificacao-identidade-render"
    output.mkdir(exist_ok=True)
    result = {
        "diagnostic": "Complete old60k Gaussian tensors inside corrected dense evaluation context",
        "context_config": str(cfg),
        "context_checkpoint": str(dense_cp),
        "context_step": int(dense_step),
        "old_checkpoint": str(old_cp),
        "old_report": str(report_path),
        "gaussian_count": count,
        "replaced_keys": list(KEYS),
        "partition_applied": False,
        "camera_transforms_applied": False,
        "filename_source": filename_source,
        "quantization": "clamp(0,1) * 255 + 0.5, then uint8 (torchvision save_image convention)",
        "visual_approval": "pending",
        "views": [],
    }
    # Persist metadata and each completed view so an interrupted diagnostic remains useful.
    def save_result():
        temporary = output / "resultado.partial.json"
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
        temporary.replace(output / "resultado.json")

    save_result()
    for frame_id in IDS:
        filename = frame_id + ".png"
        if filename not in indices or filename not in old_views:
            raise RuntimeError(f"Missing heldout in dataset/report: {filename}")
        index = indices[filename]
        view = old_views[filename]
        eval_file = root / view["eval_file"]
        with Image.open(eval_file) as image:
            combined = np.asarray(image.convert("RGB"))
        height, full_width, channels = combined.shape
        assert channels == 3 and full_width % 2 == 0, filename
        width = full_width // 2
        gt = combined[:, :width].copy()
        old_rgb = combined[:, width:].copy()

        camera = dataset.cameras[index:index + 1]
        camera_pose = camera.camera_to_worlds.detach().cpu().tolist()
        camera_intrinsics = {key: getattr(camera, key).detach().cpu().tolist()
                             for key in ("fx", "fy", "cx", "cy", "width", "height")}
        with torch.no_grad():
            outputs = pipeline.model.get_outputs_for_camera(camera)
            rgb = outputs["rgb"].detach()
            assert rgb.ndim == 3 and tuple(rgb.shape) == (height, width, 3), (filename, tuple(rgb.shape))
            assert torch.isfinite(rgb).all(), filename
            identity = (rgb.clamp(0, 1) * 255 + 0.5).clamp(0, 255).to(torch.uint8).cpu().numpy()
        difference = identity.astype(np.int16) - old_rgb.astype(np.int16)
        absolute = np.abs(difference)
        mse = float(np.mean(difference.astype(np.float64) ** 2))
        psnr = 10 * math.log10((255.0 ** 2) / mse) if mse else None

        source_file = Path(filenames[index])
        if not source_file.is_absolute():
            source_file = root / source_file
        with Image.open(source_file) as source:
            source_gt = np.asarray(source.convert("RGB"))
        assert source_gt.shape == gt.shape, (filename, source_gt.shape, gt.shape)
        gt_max_diff = int(np.abs(source_gt.astype(np.int16) - gt.astype(np.int16)).max())

        sheet = Image.new("RGB", (1920, 410), (240, 240, 240))
        draw = ImageDraw.Draw(sheet)
        psnr_label = f"{psnr:.3f} dB" if psnr is not None else "infinite"
        labels = ("GT", "Old60k stored PNG", f"Whole old60k in dense context | PSNR {psnr_label}")
        for col, (pixels, label) in enumerate(zip((gt, old_rgb, identity), labels)):
            draw.text((col * 640 + 8, 5), f"{frame_id} | pitch {view['pitch']} | {label}", fill=(0, 0, 0))
            sheet.paste(Image.fromarray(pixels).resize((640, 360)), (col * 640, 45))
        jpeg = output / f"identidade-{frame_id}.jpg"
        sheet.save(jpeg, quality=95)
        entry = {
            "id": frame_id,
            "file": view["file"],
            "room": view["comodo"],
            "pitch": view["pitch"],
            "dataset_index": index,
            "dataset_source_image": str(source_file),
            "old_eval_file": str(eval_file),
            "camera_to_worlds": camera_pose,
            "camera_intrinsics": camera_intrinsics,
            "dimensions": [width, height],
            "max_abs_error_uint8": int(absolute.max()),
            "mae_uint8": float(absolute.mean()),
            "mse_uint8": mse,
            "psnr_db": psnr,
            "psnr_is_infinite": mse == 0,
            "fraction_channels_different": float(np.mean(absolute != 0)),
            "within_one_uint8_level": int(absolute.max()) <= 1,
            "source_gt_max_abs_error_uint8": gt_max_diff,
            "source_gt_matches_within_one": gt_max_diff <= 1,
            "jpeg": str(jpeg.relative_to(root)),
            "bytes": jpeg.stat().st_size,
            "sha256": digest(jpeg),
        }
        result["views"].append(entry)
        save_result()
        print(json.dumps({key: entry[key] for key in ("id", "max_abs_error_uint8", "mae_uint8", "psnr_db", "source_gt_max_abs_error_uint8")}), flush=True)
        del outputs, rgb, identity

    result["complete"] = len(result["views"]) == len(IDS)
    result["all_gt_correspondences_valid"] = all(view["source_gt_matches_within_one"] for view in result["views"])
    result["all_renders_match_within_one"] = all(view["within_one_uint8_level"] for view in result["views"])
    result["worst_difference_order"] = [view["id"] for view in sorted(result["views"], key=lambda view: (-view["mae_uint8"], view["id"]))]
    result["interpretation"] = (
        "If source GT matches and complete old60k renders match, spatial cutting/replacement becomes the leading cause of composition losses; this diagnostic does not approve a composition."
    )
    save_result()
    print(json.dumps({"report": str(output / "resultado.json"), "complete": result["complete"], "all_gt_correspondences_valid": result["all_gt_correspondences_valid"], "all_renders_match_within_one": result["all_renders_match_within_one"]}), flush=True)


if __name__ == "__main__":
    main()
