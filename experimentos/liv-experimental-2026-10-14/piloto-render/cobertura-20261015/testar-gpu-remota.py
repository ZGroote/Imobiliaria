import torch
from gsplat.cuda._wrapper import fully_fused_projection
means = torch.tensor([[0., 0., 2.]], device='cuda')
quats = torch.tensor([[1., 0., 0., 0.]], device='cuda')
scales = torch.ones((1, 3), device='cuda') * .1
view = torch.eye(4, device='cuda')[None]
intrinsics = torch.tensor([[[100., 0., 32.], [0., 100., 32.], [0., 0., 1.]]], device='cuda')
result = fully_fused_projection(means, None, quats, scales, view, intrinsics, 64, 64)
print('GSPLAT-CUDA-PASS', result[0].tolist())
