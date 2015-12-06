app.directive('folder', function () {

    return {
        restrict: 'E',
        scope: {
            folderName: '=',

        },
        templateUrl: 'app/views/folder.html',
    }
})