import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCnpj, normalizeCnpj, maskCnpj, formatCnpj, isAlphanumericCnpj } from '../src/validators/cnpj.js';
import { isValidCep, normalizeCep } from '../src/validators/cep.js';
import { isValidCpf } from '../src/validators/cpf.js';

test('CNPJ numérico válido, com e sem máscara', () => {
  assert.equal(isValidCnpj('00.000.000/0001-91'), true);
  assert.equal(isValidCnpj('00000000000191'), true);
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
});

test('CNPJ alfanumérico: exemplo oficial Serpro/Receita 12.ABC.345/01DE-35', () => {
  assert.equal(isValidCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(isValidCnpj('12.abc.345/01de-35'), true, 'aceita minúsculas na digitação');
  assert.equal(isAlphanumericCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(isValidCnpj('12.ABC.345/01DE-34'), false, 'DV errado');
  assert.equal(isValidCnpj('12.ABC.345/01DE-3A'), false, 'DV precisa ser numérico');
});

test('CNPJ inválido', () => {
  for (const bad of ['', null, '123', '00000000000000', '11111111111111', '00.000.000/0001-92', '12ABC34501DE3', '12ÁBC34501DE35', '12ABC34501DE35x']) {
    assert.equal(isValidCnpj(bad), false, String(bad));
  }
});

test('normalização, formatação e máscara do CNPJ', () => {
  assert.equal(normalizeCnpj(' 12.abc.345/01de-35 '), '12ABC34501DE35');
  assert.equal(formatCnpj('12ABC34501DE35'), '12.ABC.345/01DE-35');
  assert.equal(maskCnpj('00.000.000/0001-91'), '00.***.***/0001-**');
  assert.equal(maskCnpj('123'), null);
});

test('CEP', () => {
  assert.equal(isValidCep('01001-000'), true);
  assert.equal(normalizeCep('01.001-000'), '01001000');
  for (const bad of ['', '0100100', '010010000', 'abcdefgh', '00000000']) assert.equal(isValidCep(bad), false, bad);
});

test('CPF', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('529.982.247-26'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
});
