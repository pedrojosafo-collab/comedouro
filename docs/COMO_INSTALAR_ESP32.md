# Como instalar o firmware do Comedouro ESP32

## 1. Instale as bibliotecas

Na Arduino IDE, abra **Ferramentas > Gerenciar Bibliotecas** e instale:

- WiFiManager
- ArduinoJson
- ESP32Servo

## 2. Abra o firmware

Abra:

`docs/ESP32_Firebase.ino`

## 3. Selecione a placa

Use uma placa ESP32 compatível, normalmente:

`ESP32 Dev Module`

## 4. Grave no ESP32

Depois do upload, abra o Monitor Serial em `115200`.

## 5. Configure o Wi-Fi pelo navegador

Na primeira inicialização, conecte o celular/PC à rede:

`COMEDOURO-ESP32`

Senha:

`12345678`

Abra:

`192.168.4.1`

Escolha sua rede e informe a senha. O ESP32 salvará a configuração e reiniciará.

## 6. Teste pelo site

Quando o ESP32 estiver conectado, ele publicará o status em:

`devices/esp32-001/status`

O painel web deve mostrar o dispositivo como **ONLINE**.

## 7. Trocar o Wi-Fi depois

Descubra o IP mostrado no Monitor Serial ou no painel local e abra esse endereço no navegador. Use **Configurar outro Wi-Fi** para apagar a rede salva e iniciar uma nova configuração.
