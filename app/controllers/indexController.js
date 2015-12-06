app.controller('indexController', ['$scope', '$routeParams', '$interval', '$q', '$location', function ($scope, $routeParams, $interval, $q, $location) {
    

    $scope.listFolders = function()
    {
        var defer = $q.defer();
        listFileSystem(defer);
        defer.promise.then(function () {
            $scope.foldersNames = folderNameList;
        })
    }

    $scope.createFolder = function () {
        var defer = $q.defer();
        createFolder($scope.newFolderName, defer);
        defer.promise.then(function () {
            $scope.listFolders();
        });
        $scope.folderCreation = false;
    }

    $scope.deleteFolder = function (folderName) {
        var defer = $q.defer();
        removeFolder(folderName, defer);
        defer.promise.then(function () {
            $scope.listFolders();
        })
    }

    $scope.selectFolder = function (folder) {
        $location.path('/room/' + folder);
    }

    function init() {
        var defer = $q.defer();
        initFs(defer)
        defer.promise.then(function () {
            $scope.listFolders();
        })
        

    }

    init()
}])