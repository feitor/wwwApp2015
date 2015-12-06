var app = angular.module('AngularWebRTC', [
    'ngRoute',
    'ngResource'
]);

app.config( function ($routeProvider) {

    $routeProvider.when("/home", {
        controller: "homeController",
        templateUrl: "/app/views/home.html"
    });

    $routeProvider.when("/room/:roomName", {
        controller: "roomController",
        templateUrl: "/app/views/room.html"
    });

    $routeProvider.otherwise({ redirectTo: "/home" });
});
app.config( function ($compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|filesystem):/);

});