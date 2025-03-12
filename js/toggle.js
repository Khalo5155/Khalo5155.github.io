(function(){
    var toggle_button = document.getElementById('Toggle');
    var mainbox = document.getElementById('mainbox');
    var mainbox_2 = document.getElementById('mainbox_2');
    var toggle_switch = 0;
    toggle_button.addEventListener("click", function(){
        toggle_switch = (toggle_switch + 1) % 2;
        // console.log(toggle_switch);
        if (toggle_switch == 1) {
            mainbox.className = 'hidden';
            mainbox_2.className = 'mainbox_2';
        }
        else {
            mainbox.className = 'mainbox';
            mainbox_2.className = 'hidden';
        }
    });
})();