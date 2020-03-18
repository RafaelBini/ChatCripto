

// Instancia o firestore
var db = firebase.firestore();
var privateKey = null;
var theSimKey = null;
var meuIP = null;

function iniciar() {

    // Guarda as tabelas vazias
    var usersTableVazia = document.getElementById("userTable").innerHTML;
    var simKeysTableVazia = document.getElementById("simKeysTable").innerHTML;
    var chatTableVazia = document.getElementById("chatTable").innerHTML;


    // Começa a ouvir as CONVERSAR do firestore
    db.collection("conversa").orderBy('dt')
        .onSnapshot(function (querySnapshot) {

            // Se não exite simKey definida, vaza
            if (theSimKey == null)
                return;

            // Limpa a tabela
            document.getElementById("chatTable").innerHTML = chatTableVazia;

            // Passa por cada mensagem
            querySnapshot.forEach(function (doc) {

                // Recebe a cifra da mensagem e o usuario
                var cifraMsg = doc.data().msg;
                var cifraUser = doc.data().user;

                try {
                    // Decripta a cifra da mensagem e o usuario
                    var decMsg = CryptoJS.AES.decrypt(cifraMsg, theSimKey).toString(CryptoJS.enc.Utf8);
                    var decUser = CryptoJS.AES.decrypt(cifraUser, theSimKey).toString(CryptoJS.enc.Utf8);

                    // Recebe a data
                    // var myDate = doc.data().dt.toDate().toLocaleString();

                    // Se conseguiu decriptar,
                    if (decMsg != "" && decUser != "") {
                        // Mostra cifra
                        document.getElementById("chatTable").innerHTML += `<div class="cifraMsg">${cifraMsg}</div>`;

                        // Mostra decript
                        document.getElementById("chatTable").innerHTML += `<div class="normalMsg" title="${cifraMsg}"><b>${decUser}:</b> ${decMsg}</div>`;

                        // Desce o scroll
                        $('#chatTable').scrollTop($('#chatTable')[0].scrollHeight);
                    }

                }
                catch{

                }

            });

        });

    // Começa a ouvir os USUÁRIOS ONLINE do firestore
    db.collection("users").orderBy('userName')
        .onSnapshot(function (querySnapshot) {
            // Limpa a tab de usuarios
            document.getElementById("userTable").innerHTML = usersTableVazia;

            // Passa por cada usuario
            querySnapshot.forEach(function (doc) {
                // Insere o html na tabela de usuários                     
                document.getElementById("userTable").innerHTML += `<tr><td>${doc.data().userName}</td><td>${doc.id}</td><td><input type='button' value="Enviar Chave" onclick="enviarSimKey('${doc.id}')" /></td></tr>`;
            });

        });


    // Começa a ouvir as CHAVES SIMETRICAS RECEBIDAS recebidas
    db.collection("simKeys")
        .onSnapshot(function (querySnapshot) {

            // Limpa a tabela
            document.getElementById("simKeysTable").innerHTML = simKeysTableVazia;

            // Passa por cada simKey publicada
            querySnapshot.forEach(function (doc) {

                // Recebe a cifra
                var cifra = doc.data().cifra;

                // Decripta a cifra com a minha chave primária
                var encrypt = new JSEncrypt();
                encrypt.setPrivateKey(privateKey);
                var decSimKey = encrypt.decrypt(cifra);

                // Se eu consigo decriptar,
                if (decSimKey != null) {
                    // Insere o html na tabela de simKeys                   
                    document.getElementById("simKeysTable").innerHTML += `<tr><td>${cifra.substring(0, 55) + "..."}</td><td>${decSimKey}</td><td><input type='button' value="Ouvir" onclick="ouvirSimKey('${decSimKey}')" /></td></tr>`;
                }
            });

        });


    // Faz requisição para receber o ip
    $.getJSON('http://ip-api.com/json?callback=?', function (data) {

        // Recebe o IP                
        meuIP = JSON.stringify(data.query, null, 2).replace(/"/g, '');

        // Começa a ouvir o beforeunload
        window.addEventListener("beforeunload", function (event) {
            // Manda uma msg para notificar a saida
            enviarMensagem("Tchau, eu sai do chat")

            // Exclui o usuario do firebase
            db.collection("users").doc(meuIP).delete();
        });

        // Instancia o JSEncrypt
        var crypt = new JSEncrypt();

        // Recebe a chave privada
        privateKey = crypt.getPrivateKey().toString();

        // Recebe a chave publica
        var publicKey = crypt.getPublicKey().toString();

        // Recebe o nome do usuario
        var userName = document.meuForm.user.value.toString();

        // Salva o usuario no bd
        db.collection("users").doc(meuIP).set({
            userName: userName,
            publicKey: publicKey
        }, { merge: true })
    });


}

function ouvirSimKey(simKey) {

    // Valida a key
    if (simKey == null || simKey == "") {
        alert("Você precisa escolher uma Chave Simétrica!");
        return;
    }

    // Seta uma nova simKey
    theSimKey = simKey;

    // Mostra
    document.getElementById("simKeyOuvida").innerText = simKey;

    // Manda uma msg para atualizar o chat
    enviarMensagem("Olá, eu entrei no chat")
}

function enviarMensagem(msg) {

    // Se não existe simKey definida,
    if (theSimKey == null) {
        alert("Você precisa 'ouvir' uma Chave Simétrica para poder enviar mensagens");
        return;
    }

    // Encripta a mensagem
    var encMsg = CryptoJS.AES.encrypt(msg, theSimKey);

    // Encripta o usuario
    var encUser = CryptoJS.AES.encrypt(document.meuForm.user.value.toString(), theSimKey);

    // Salva no banco de dados
    db.collection("conversa").doc().set({
        dt: firebase.firestore.FieldValue.serverTimestamp(),
        msg: encMsg.toString(),
        user: encUser.toString()
    })

    // Limpa o campo de texto
    document.meuForm.msg.value = "";
}

function enviarSimKey(userId) {

    // Valida se uma simKey nova foi digitada
    if (document.getElementById("simKeyToSend").value == "") {
        alert("Você deve digitar uma simKey!");
        return;
    }

    // Recebe info do usuario no firestore
    db.collection("users").doc(userId)
        .get().then(function (doc) {

            // Se existe o documento,
            if (doc.exists) {

                // Recebe a publicKey
                var publicKey = doc.data().publicKey;

                // Recebe a chave simetrica digitada
                var simKey = document.getElementById("simKeyToSend").value;

                // Encripta a simKey
                var encrypt = new JSEncrypt();
                encrypt.setPublicKey(publicKey);
                var encSimKey = encrypt.encrypt(simKey).toString();

                // Publica a simKey encriptada no banco de dados
                db.collection("simKeys").doc().set({
                    cifra: encSimKey
                });
            }

            // Se o documento não existe,
            else {
                // Informa
                console.log("Usuario não encontrado");
            }

        }).catch(function (error) {
            console.log("Erro ao procurar documento:", error);
        });
}

function refreshMyUser() {
    // Recebe o user
    var newUserName = document.meuForm.user.value;

    // Atualiza a coleção users
    db.collection("users").doc(meuIP).update({
        userName: newUserName
    });

}