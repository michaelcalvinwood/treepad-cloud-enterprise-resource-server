#/bin/bash

clear
rsync -a --exclude node_modules . root@treepadcloudenterprise.com:/home/resourceServer
