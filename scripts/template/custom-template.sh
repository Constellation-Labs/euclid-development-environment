#!/usr/bin/env bash

function create_template() {
    AVAILABLE_FRAMEWORKS="currency"
    if [[ ! " ${AVAILABLE_FRAMEWORKS[*]} " =~ $FRAMEWORK_NAME ]]; then
        echo_red "You should select a valid framework"
        exit 1
    fi

    cd $SOURCE_PATH/$1
    if [ -d "$PROJECT_NAME" ]; then
        echo_yellow "Template already exists!"
    else
        echo_white "Generating template $PROJECT_NAME ..."
        
        echo_white "Template version: $TEMPLATE_VERSION"
        echo_white "Template version is tag or branch: $TEMPLATE_VERSION_IS_TAG_OR_BRANCH"
        
        if [ "$TEMPLATE_VERSION_IS_TAG_OR_BRANCH" == "tag" ]; then
            if [[ " ${FRAMEWORK_MODULES[*]} " =~ "data" ]]; then
                g8 Constellation-Labs/currency --tag $TEMPLATE_VERSION --name="$PROJECT_NAME" --tessellation_version="$TESSELLATION_VERSION" --include_data_l1="yes"
            else
                g8 Constellation-Labs/currency --tag $TEMPLATE_VERSION --name="$PROJECT_NAME" --tessellation_version="$TESSELLATION_VERSION"
            fi
        else
            if [[ " ${FRAMEWORK_MODULES[*]} " =~ "data" ]]; then
                g8 Constellation-Labs/currency --branch $TEMPLATE_VERSION --name="$PROJECT_NAME" --tessellation_version="$TESSELLATION_VERSION" --include_data_l1="yes"
            else
                g8 Constellation-Labs/currency --branch $TEMPLATE_VERSION --name="$PROJECT_NAME" --tessellation_version="$TESSELLATION_VERSION"
            fi
        fi
        
    fi
}

function check_if_project_name_is_set() {
    if [[ -z "$PROJECT_NAME" ]]; then
        echo_red "You should provide the PROJECT_NAME on euclid.json file"
        exit 1
    fi
}

function check_if_project_directory_exists() {
    if [ ! -d "$SOURCE_PATH/project/$PROJECT_NAME" ]; then
        echo_red "You must install a framework before building. Run hydra install first"
        exit 1
    fi
}
