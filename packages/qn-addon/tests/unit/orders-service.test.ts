import * as ordersService from '../../src/services/orders-service';
import * as cryptoService from '../../src/services/crypto-service';

describe('orders-service', () => {
  it('encrypts and decrypts an order payload roundtrip', () => {
    const user = cryptoService.generate();
    const solver = cryptoService.generate();

    const encrypted = ordersService.encryptOrder(
      { minOutputAmount: '1000000', slippageBps: 50, deadline: 1700000000 },
      solver.publicKey,
      user,
    );

    expect(encrypted.bytes.length).toBeGreaterThan(0);

    const decrypted = ordersService.decryptOrder(encrypted.bytes, user.publicKey, solver);
    expect(decrypted.minOutputAmount).toBe('1000000');
    expect(decrypted.slippageBps).toBe(50);
    expect(decrypted.deadline).toBe(1700000000);
  });
});
