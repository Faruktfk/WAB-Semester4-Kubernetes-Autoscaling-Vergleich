# WAB-Semester4-Kubernetes-Autoscaling-Vergleich

# Setup Schritte
## Minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
minikube start

## Kubectl
curl -LO "https://dl.k8s.io/release/\
    $(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

## Cluster
kubectl create ns prototype
kubectl config set-context --current --namespace=prototype
minikube addons enable metrics-server

## Starte server.js
eval $(minikube -p minikube docker-env)
docker build -t prototype/server:0.1 ./server
kubectl apply -f k8s/app.yaml

## PROMETHEUS
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prom prometheus-community/prometheus -f k8s/prometheus-values.yaml -n monitoring
kubectl port-forward svc/prom-prometheus-server 9090:80 -n monitoring

## GRAFANA
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install graf grafana/grafana \
  --set adminPassword=admin \
  --set service.type=ClusterIP \
  --set persistence.enabled=false \
  --set datasources."datasources/.yaml".apiVersion=1 \
  --set datasources."datasources/.yaml".datasources[0].name=Prometheus \
  --set datasources."datasources/.yaml".datasources[0].type=prometheus \
  --set datasources."datasources/.yaml".datasources[0].url=http://prom-prometheus-server \
  --set datasources."datasources/.yaml".datasources[0].access=proxy \
  -n monitoring
kubectl port-forward svc/graf-grafana 3000:80 -n monitoring

## VPA-Autoscaler:
cd k8s
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler
./vertical-pod-autoscaler/hack/vpa-up.sh
cd ..
cd ..

## K6
kubectl apply -f k6/configmap.yaml

## Experimente
### 1. CPU & HPA
kubernetes delete vpa --all --ignore-not-found && kubernetes delete jobs --all
kubectl apply -f k8s/hpa-cpu.yaml
kubectl apply -f k6/job-cpu.yaml
### 2. CPU & VPA
kubernetes delete hpa --all --ignore-not-found && kubernetes delete jobs --all
kubectl apply -f k8s/vpa.yaml
kubectl apply -f k6/job-cpu.yaml
### 3. Mem & HPA
kubernetes delete vpa --all --ignore-not-found && kubernetes delete jobs --all
kubectl apply -f k8s/hpa-cpu.yaml
kubectl apply -f k6/job-mem.yaml
### 4. Mem & VPA
kubernetes delete hpa --all --ignore-not-found && kubernetes delete jobs --all
kubectl apply -f k8s/vpa.yaml
kubectl apply -f k6/job-mem.yaml




---

# Erase everything:
```bash
minikube stop
minikube delete
docker system prune -a
sudo rm /usr/local/bin/kubectl
sudo rm /usr/local/bin/helm
rm -rf ~/.minikube
rm -rf ~/.kube
rm -rf ~/.helm
```


---

# How to import Grafana dashboard:
- After Port-Forwarding Grafana to e.i. localhost:3000
- Visit "http://localhost:3000"
- Navigate to "Dashboards" and click "New"
- Select "Import" and upload the `WAB4-Grafana-Dashboard.json` file.

The dashboard should appear among other dashboards.