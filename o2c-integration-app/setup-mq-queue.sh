#!/bin/bash

# Script to create IBM MQ queue after container startup
# Wait for MQ to be ready, then create the queue

echo "Waiting for IBM MQ to be ready..."
sleep 10

echo "Creating queue: customer_purchase_orders"

docker exec o2c-ibmmq bash -c "
  echo 'DEFINE QLOCAL(customer_purchase_orders) REPLACE' | runmqsc QM1
  echo 'SET AUTHREC OBJTYPE(QMGR) PRINCIPAL('\''app'\'') AUTHADD(CONNECT,INQ)' | runmqsc QM1
  echo 'SET AUTHREC PROFILE(customer_purchase_orders) OBJTYPE(QUEUE) PRINCIPAL('\''app'\'') AUTHADD(ALLMQI)' | runmqsc QM1
"

echo "Queue created successfully!"
echo "Queue name: customer_purchase_orders"
echo "Queue Manager: QM1"

# Made with Bob
