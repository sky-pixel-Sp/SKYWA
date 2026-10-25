cmake_minimum_required(VERSION 3.22.1)
project(skywa_node_bridge LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(NODE_RUNTIME_DIR "${CMAKE_CURRENT_SOURCE_DIR}/libnode")
set(NODE_LIBRARY "${NODE_RUNTIME_DIR}/bin/${ANDROID_ABI}/libnode.so")

if(NOT EXISTS "${NODE_LIBRARY}")
    message(FATAL_ERROR "Embedded Node.js library missing for ${ANDROID_ABI}. Run bash scripts/prepare-standalone-android.sh first.")
endif()

if(NOT EXISTS "${NODE_RUNTIME_DIR}/include/node/node.h")
    message(FATAL_ERROR "Node.js headers missing. Run bash scripts/prepare-standalone-android.sh first.")
endif()

add_library(node_runtime SHARED IMPORTED GLOBAL)
set_target_properties(node_runtime PROPERTIES IMPORTED_LOCATION "${NODE_LIBRARY}")

add_library(skywa-node-bridge SHARED node-bridge.cpp)
target_include_directories(skywa-node-bridge PRIVATE "${NODE_RUNTIME_DIR}/include/node")
find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(skywa-node-bridge node_runtime ${log-lib} ${android-lib})
