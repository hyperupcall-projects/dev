# shellcheck shell=bash

# include-what-you-use, oclint, clazy
# https://hackingcpp.com/cpp/tools/ecosystem.html

# TODO: https://github.com/cpp-best-practices/cppbestpractices/blob/master/02-Use_the_Tools_Available.md
init() {
    declare -g CXXFLAGS_BARE=(-Wall -Wextra)
    declare -g CXXFLAGS_FULL=(
        -Wall -Wextra -Wpedantic -Wshadow -Wvla 
        -Wnon-virtual-dtor -Wframe-larger-than=5000 -Wstack-usage=10000 
        -Wnon-virtual-dtor -Wold-style-cast -Wcast-align -Wunused -Woverloaded-virtual -Wpedantic -Wconversion
        -Wsign-conversion  -Wmisleading-indentation -Wduplicated-cond  -Wduplicated-branches -Wlogical-op -Wnull-dereference
        -Wuseless-cast -Wdouble-promotion -Wformat=2 -Wimplicit-fallthrough
        -fanalyzer -fsanitize=address,undefined
    )
}

task.compile:bare() {
    bear gcc "${CXXFLAGS_BARE[@]}" ./main.cpp
    scan-build gcc # TODO
}

task.compile:full() {
    bear gcc "${CXXFLAGS_FULL[@]}" ./main.cpp
}

task.check:clang-check() {
    clang-check ./main.cpp
}

task.check:clang-format() {
    clang-format -i ./main.cpp
}

task.check:clang-tidy() {
    clang-tidy ./main.cpp
}

task.cppcheck() {
    cppcheck ./main.cpp
}

task.codespell() {
    codespell ./main.cpp 
}

task.replay() {
    rr
}