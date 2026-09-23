# Model results

Trained 2026-09-23 12:22 on synthetic data (`data/generate.py`, seed 42). Hold-out split 80/20; final models are refit on all data.

| Model | Algorithm | Metric |
|---|---|---|
| Smart speed | RandomForestRegressor | R² 0.9819, MAE 0.614 km/h |
| Engine fault | RandomForestClassifier | accuracy 0.966, macro F1 0.9396 |
| Task time | RandomForestRegressor | R² 0.8922, MAE 9.67 min, MAPE 13.4% |
| Unusual behavior | IsolationForest | precision 0.974, recall 0.9223, F1 0.9475 |

## Speed: top features

- `machine_type_loader`: 0.543
- `accel_z`: 0.272
- `surface_mud`: 0.048
- `slope_deg`: 0.033
- `load_pct`: 0.03

## Engine fault: per class

```
                  precision    recall  f1-score   support

    bearing_wear      0.889     0.901     0.895        71
low_oil_pressure      0.938     0.987     0.962        77
          normal      0.979     0.985     0.982       714
     overheating      0.951     0.856     0.901        90
    sensor_fault      0.958     0.958     0.958        48

        accuracy                          0.966      1000
       macro avg      0.943     0.937     0.940      1000
    weighted avg      0.966     0.966     0.966      1000
```

## Anomaly: recall by anomaly type

- `excessive_idling`: 1.0
- `fuel_waste`: 0.664
- `unsafe_operation`: 0.986
