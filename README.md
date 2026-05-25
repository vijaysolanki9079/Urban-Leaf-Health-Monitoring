# Urban-Leaf-Health-Monitoring

Urban-Leaf-Health-Monitoring is an end-to-end system for tracking urban vegetation health and land-use change. Leveraging satellite and aerial imagery, machine learning, and computer vision, it enables robust monitoring of ecological shifts, urban expansion, and deforestation events across diverse regions.

## Key Insights

- **Automated Area Selection:** Efficient sampling and region-of-interest extraction for large-scale analysis.
- **Cloud-Masked Data Pipeline:** Preprocessing ensures high-quality, cloud-free imagery for reliable results.
- **Augmentation & Restoration:** Extensive data augmentation (flipping, zooming, restoration) boosts model robustness.
- **Multispectral Analysis:** Radiometric normalization and spectral transformations (NDVI, EVI, SAVI) provide deep vegetation health insights.
- **Feature Engineering:** Texture (GLCM), spectral statistics, and morphological features enhance classification accuracy.
- **Flexible Modeling:** Supports SVM, Random Forest, and U-Net for both segmentation and health classification.
- **Temporal Event Tracking:** Enables comparison of ecological events (e.g., bushfires, mining) and multi-year change detection.
- **Urban Metrics Visualization:** Generates actionable insights for city planning and conservation.


## Study Regions

- **Hasdeo Forest:** Deforestation and mining impacts (2018–2023)
- **Sydney Blue Mountains Fringe:** Urban expansion and ecological shifts
- **Kangaroo Island:** Black Summer bushfire impacts

## Repository Structure

```
.
├── assets/
│   ├── plots/                  # Visualizations and result plots
│   └── presentation_images/    # Key images for presentations
├── data/
│   ├── 01_area_of_interest_selection_using_sampling/
│   │   ├── batch_1/            # Hasdeo Forest dataset
│   │   ├── batch_2/            # Sydney Blue Mountains dataset
│   │   └── batch_3/            # Kangaroo Island dataset
│   └── 02_comparison_based_on_events/
│       ├── event_1/            # Hasdeo event CSVs and logs
│       └── event_2/            # Additional event CSVs
├── h100_config/                # HPC scripts, configs, and guides
├── initial_resources/          # Reference calculations
├── scripts/
│   ├── 01_area_of_interest_selection/
│   ├── 02_comparison_based_on_events/
│   ├── 03_comparison_based_on_years/
│   └── sample/
├── LICENSE
├── README.md
```

## Features & Roadmap

### Phase 1: Data Engineering

- [x] Data Collection: sampled RGB datasets plus Hasdeo all-band GeoTIFF export manifests
- [x] Preprocessing: cloud QC, valid-pixel filtering, patch extraction, radiometric normalization
- [x] Augmentation: multi-band spatial and spectral augmentation pipeline
- [ ] Full local sync of all exported 1,000+ Hasdeo GeoTIFF files

### Phase 2: Core Analytics

- [x] Spectral Indices: NDVI, EVI, SAVI, BSI, NBR and related land-cover indicators
- [x] Baseline Modeling: Random Forest exploration and Attention U-Net implementation
- [x] Training Pipeline: AMP, checkpointing, resume support, class distribution report
- [ ] Final supervised masks and production-grade benchmark metrics

### Phase 3: Temporal & Event Analysis

- [x] Event Comparison: Hasdeo event windows including March–April 2022 degradation signals
- [x] Time-Series Export: monthly/seasonal Hasdeo exports across pre-event, event, and post-event phases
- [x] Inference Outputs: segmentation masks, overlays, GeoTIFF masks, and JSON summaries
- [ ] Final dashboard / web application layer

## Current Completion Status

The non-web research pipeline is now close to complete as a reproducible prototype:

1. Select and verify study regions.
2. Export cloud-filtered satellite data from Google Earth Engine.
3. Convert and catalog imagery for inspection.
4. Build spectral-index feature tables for event and year-wise comparison.
5. Preprocess multispectral GeoTIFFs into normalized training patches.
6. Augment patches for model robustness.
7. Train an Attention U-Net segmentation model on H100.
8. Generate inference masks, overlays, GeoTIFF outputs, and class-ratio summaries.

The remaining scientific gap is not code structure; it is data quality: replacing pseudo-labels with expert/manual masks and recording final benchmark metrics on held-out ground truth.

## Quick Start

### Prerequisites

- Python 3.9+
- Spatial data libraries (Rasterio, GDAL)
- PyTorch / TensorFlow

### Installation

```bash
git clone https://github.com/Manjushwarofficial/Urban-Leaf-Health-Monitoring.git
cd Urban-Leaf-Health-Monitoring
pip install -r requirements.txt
```

### HPC Pipeline

```bash
cd h100_config
bash setup_env.sh
qsub job_cpu.pbs
qsub job_gpu.pbs
```

Manual training and inference:

```bash
python 05_train.py \
  --data-dir /Data/username/urban_tree_project/augmented \
  --model-dir /Data/username/urban_tree_project/models \
  --results-dir /Data/username/urban_tree_project/results

python 06_predict_visualize.py \
  --checkpoint /Data/username/urban_tree_project/models/best_model.pth \
  --input /Data/username/urban_tree_project/processed \
  --output-dir /Data/username/urban_tree_project/results/inference_preview
```

## Evaluation Metrics

- **Segmentation:** Mean Intersection over Union (mIoU), Dice Coefficient
- **Classification:** Precision-Recall, Confusion Matrix
- **Temporal:** Quantitative land-cover loss


## Contributing

Contributions are welcome! Help select new regions or improve the augmentation pipeline by opening an issue.

## License

MIT License - see [LICENSE](https://github.com/Manjushwarofficial/Urban-Leaf-Health-Monitoring/blob/main/LICENSE)
