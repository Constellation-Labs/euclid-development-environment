function create_template() {
    AVAILABLE_FRAMEWORKS="currency"
    if [[ ! " ${AVAILABLE_FRAMEWORKS[*]} " =~ $FRAMEWORK_NAME ]]; then
        echo "You should select a valid framework"
        exit 1
    fi

    cd source/$1
    if [ -d "$PROJECT_NAME" ]; then
        echo "Template already exists!"
    else
        echo "Generating template $PROJECT_NAME ..."
        
        echo "Template version: $TEMPLATE_VERSION"
        echo "Template version is tag or branch: $TEMPLATE_VERSION_IS_TAG_OR_BRANCH"
        
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
    cd ../../
}

function check_if_project_name_is_set() {
    if [[ -z "$PROJECT_NAME" ]]; then
        echo "You should provide the PROJECT_NAME on euclid.json file"
        exit 1
    fi
}

function check_if_project_directory_exists() {
    cd ../source/
    if [ ! -d "project/$PROJECT_NAME" ]; then
        echo "You must install a framework before building. Run hydra install first"
        exit 1
    fi
    cd ../scripts/
}
