"""
Training Script — Chest X-Ray Pneumonia Classifier
====================================================
Dataset: Kaggle Chest X-Ray Images (Pneumonia)
https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia

Architecture: ResNet-50 with fine-tuned classifier head
Expected test accuracy: ~95%

Usage:
  python train_xray.py --data_dir ./data/chest_xray --epochs 10 --batch_size 32
"""

import argparse
import os
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms
from torch.optim import Adam
from torch.optim.lr_scheduler import OneCycleLR


# ── Config ────────────────────────────────────────────────────────────────────

CLASSES = ['Normal', 'Pneumonia']
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
WEIGHTS_OUT = Path(__file__).parent / 'weights' / 'xray_pneumonia_resnet50.pth'

def get_transforms(train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize(256),
            transforms.RandomCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(10),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
    return transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def build_model():
    model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    # Freeze early layers, fine-tune layer3+ and classifier
    for name, param in model.named_parameters():
        if 'layer1' in name or 'layer2' in name:
            param.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, len(CLASSES))
    return model.to(DEVICE)


def train_epoch(model, loader, optimizer, scheduler, criterion):
    model.train()
    total_loss, correct = 0.0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        out = model(imgs)
        loss = criterion(out, labels)
        loss.backward()
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()
        correct += (out.argmax(1) == labels).sum().item()
    n = len(loader.dataset)
    return total_loss / len(loader), correct / n


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total_loss, correct = 0.0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        out = model(imgs)
        total_loss += criterion(out, labels).item()
        correct += (out.argmax(1) == labels).sum().item()
    n = len(loader.dataset)
    return total_loss / len(loader), correct / n


def main(args):
    print(f"Device: {DEVICE}")
    WEIGHTS_OUT.parent.mkdir(exist_ok=True)

    # Datasets — expects ImageFolder structure: train/NORMAL, train/PNEUMONIA, etc.
    data_dir = Path(args.data_dir)
    train_ds = datasets.ImageFolder(data_dir / 'train', transform=get_transforms(True))
    val_ds = datasets.ImageFolder(data_dir / 'val', transform=get_transforms(False))
    test_ds = datasets.ImageFolder(data_dir / 'test', transform=get_transforms(False))

    print(f"Train: {len(train_ds)}, Val: {len(val_ds)}, Test: {len(test_ds)}")
    print(f"Classes: {train_ds.classes}")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, num_workers=4)
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, num_workers=4)

    # Model, loss, optimizer
    model = build_model()
    # Weighted loss for class imbalance (more Pneumonia than Normal in dataset)
    criterion = nn.CrossEntropyLoss(weight=torch.tensor([1.5, 1.0]).to(DEVICE))
    optimizer = Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=args.lr)
    scheduler = OneCycleLR(optimizer, max_lr=args.lr, steps_per_epoch=len(train_loader), epochs=args.epochs)

    best_val_acc = 0.0
    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, scheduler, criterion)
        val_loss, val_acc = evaluate(model, val_loader, criterion)

        print(f"Epoch {epoch:02d}/{args.epochs}  "
              f"train_loss={train_loss:.4f}  train_acc={train_acc:.3f}  "
              f"val_loss={val_loss:.4f}  val_acc={val_acc:.3f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), WEIGHTS_OUT)
            print(f"  ↑ Saved best model (val_acc={val_acc:.3f}) → {WEIGHTS_OUT}")

    # Final test evaluation
    model.load_state_dict(torch.load(WEIGHTS_OUT, map_location=DEVICE))
    _, test_acc = evaluate(model, test_loader, criterion)
    print(f"\nTest Accuracy: {test_acc:.4f}")
    print(f"Weights saved: {WEIGHTS_OUT}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data_dir', default='./data/chest_xray')
    parser.add_argument('--epochs', type=int, default=10)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--lr', type=float, default=1e-4)
    main(parser.parse_args())
