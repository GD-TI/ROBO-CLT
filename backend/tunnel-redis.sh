#!/bin/bash

echo "================================================"
echo "  Túnel SSH para Redis do Google Cloud"
echo "================================================"
echo ""

# Configurações (EDITE AQUI)
VM_NAME="sua-vm"
VM_ZONE="us-central1-a"
REDIS_IP="10.0.0.3"
REDIS_PORT="6379"
LOCAL_PORT="6379"

echo "Criando túnel SSH..."
echo "VM: $VM_NAME"
echo "Zone: $VM_ZONE"
echo "Redis: $REDIS_IP:$REDIS_PORT"
echo "Local: localhost:$LOCAL_PORT"
echo ""
echo "Conectando..."
echo ""

gcloud compute ssh $VM_NAME \
  --zone=$VM_ZONE \
  -- -N -L $LOCAL_PORT:$REDIS_IP:$REDIS_PORT

echo ""
echo "Túnel encerrado."
