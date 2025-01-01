#!/bin/bash

# Create required directories
mkdir -p falcon/public
mkdir -p sage/common
mkdir -p sage/public
mkdir -p common

# Copy proto files to respective directories
# Replace paths with your actual proto file locations
cp /Users/dushyant.bansal/work/thoughtspot/common/common.proto common/
cp /Users/dushyant.bansal/work/thoughtspot/common/formating_types.proto common/
cp /Users/dushyant.bansal/work/thoughtspot/falcon/public/data_type.proto falcon/public/
cp /Users/dushyant.bansal/work/thoughtspot/sage/common/common.proto sage/common/
cp /Users/dushyant.bansal/work/thoughtspot/sage/public/common.proto sage/public/
cp /Users/dushyant.bansal/work/thoughtspot/sage/public/date_filter.proto sage/public/
cp /Users/dushyant.bansal/work/thoughtspot/sage/public/sage_expression.proto sage/public/
cp /Users/dushyant.bansal/work/thoughtspot/sage/public/query_spec.proto sage/public/

# Generate Python classes
# The --python_out=. generates files in the same directory structure
protoc -I. \
    --python_out=. \
    common/common.proto \
    common/formating_types.proto \
    falcon/public/data_type.proto \
    sage/common/common.proto \
    sage/public/common.proto \
    sage/public/date_filter.proto \
    sage/public/sage_expression.proto \
    sage/public/query_spec.proto

# Create __init__.py files for Python packages
touch common/__init__.py
touch falcon/__init__.py
touch falcon/public/__init__.py
touch sage/__init__.py
touch sage/common/__init__.py
touch sage/public/__init__.py
