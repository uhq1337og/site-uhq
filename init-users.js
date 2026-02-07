<!-- Add this at the end of home.html body before closing </body> -->
<script>
// Initialize user IDs for existing accounts
(function() {
    const users = JSON.parse(localStorage.getItem('usersList') || '[]');
    let needsSave = false;
    
    users.forEach(user => {
        if (!user.userId) {
            user.userId = 'USER_' + Math.random().toString(36).substr(2, 9).toUpperCase();
            user.createdAt = user.createdAt || new Date().toISOString();
            needsSave = true;
        }
    });
    
    if (needsSave) {
        localStorage.setItem('usersList', JSON.stringify(users));
        console.log('✅ User IDs initialized for existing accounts');
    }
})();
</script>
