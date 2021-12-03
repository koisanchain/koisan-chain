Koisan International Coin
=====================================

http://koisan-chain.com

What is Koisan International Coin?
----------------

Koisan International Coin is one of Asia cryptocurrency developed in Indonesia designed to support nft project in Asia and the world, it also designed for using exactly the way money is supposed to be. Koisan International Coin was created to become a digital version of money that people can be use all around the world not only in Asia.

For more information read the
[original whitepaper](http://koisan-chain.com/).

## Installation Instruction

#### Install NodeJs

We recommend to use nodejs V16.x.x

<code>sudo apt update</code>\
<code>sudo apt install nodejs</code>

#### Install Redis Server

<code>sudo apt install redis-server</code>

This will download and install Redis and its dependencies. Following this, there is one important configuration change to make in the Redis configuration file, which was generated automatically during the installation.

<code>sudo nano /etc/redis/redis.conf</code>

Inside the file, find the supervised directive. This directive allows you to declare an init system to manage Redis as a service, providing you with more control over its operation. The supervised directive is set to no by default. Since you are running Ubuntu, which uses the systemd init system, change this to systemd:

<code>supervised **_systemd_**</code>

That’s the only change you need to make to the Redis configuration file at this point, so save and close it when you are finished.

Then, restart the Redis service to reflect the changes you made to the configuration file:

<code>sudo systemctl restart redis.service</code>

#### Clone this git
<code>git clone https://github.com/koisanchain/koisan-chain.git </code>\
<code>cd koisan-chain</code>\
<code>npm i -f</code>



#### Testing KoisanChain
<code>npm run dev</code>


#### Running KoisanChain
<code>npm run start</code>


License
-------

KoisanChain is released under the terms of the MIT license. See [COPYING](COPYING) for more
information or see https://opensource.org/licenses/MIT.