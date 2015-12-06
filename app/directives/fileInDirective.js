app.directive('fileIn', function () {
   
    return {
        restrict: 'E',
        scope: {
            file : '=',
           
        },
        templateUrl: 'app/views/fileIn.html',
    }
})