app.directive('fileOut', function () {
    
    return {
        restrict: 'E',
        scope: {
            file : '=',
           
        },
        templateUrl: 'app/views/fileOut.html',
    }
})